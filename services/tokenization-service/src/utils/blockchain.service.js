import { ethers } from "ethers";
import { BLOCKCHAIN } from "../config/services.js";
import { logger } from "linkay-shared-utils";

// ── Minimal ABIs for each contract ──────────────────────────────────────────

const NFT_FACTORY_ABI = [
    "function deployAssetNFT(bytes32 assetId, string calldata metadataURI, address owner) external returns (uint256 tokenId, address contractAddress)",
    "event AssetNFTDeployed(bytes32 indexed assetId, uint256 indexed tokenId, address contractAddress)",
];

const FRACTIONAL_TOKEN_FACTORY_ABI = [
    "function deployFractionalToken(string calldata name, string calldata symbol, uint256 supply, address complianceModule, address identityRegistry) external returns (address contractAddress)",
    "event FractionalTokenDeployed(address indexed contractAddress, string name, uint256 supply)",
];

const FRACTIONAL_TOKEN_ABI = [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
];

const COMPLIANCE_MODULE_ABI = [
    "function setJurisdictionRules(address tokenContract, bytes2[] calldata allowedCountries, uint8 eligibilityLevel) external returns (bool)",
    "function setLockUp(address investor, address tokenContract, uint256 unlockTimestamp) external",
    "function isTransferValid(address from, address to, uint256 amount) external view returns (bool)",
];

const IDENTITY_REGISTRY_ABI = [
    "function addIdentity(address _wallet, bytes32 _identity) external",
    "function isVerified(address _wallet) external view returns (bool)",
];

// ── Provider & Signer ────────────────────────────────────────────────────────

let _provider = null;
let _signer = null;

const getProvider = () => {
    if (!_provider) {
        _provider = new ethers.JsonRpcProvider(BLOCKCHAIN.rpcUrl);
    }
    return _provider;
};

const getSigner = () => {
    if (!_signer) {
        _signer = new ethers.Wallet(BLOCKCHAIN.platformWalletPrivateKey, getProvider());
    }
    return _signer;
};

// ── Gas estimation helper ────────────────────────────────────────────────────

const estimateAndSend = async (contract, method, args) => {
    const gasEstimate = await contract[method].estimateGas(...args);
    const gasLimit = (gasEstimate * BigInt(Math.ceil(parseFloat(process.env.GAS_PRICE_MULTIPLIER || "1.2") * 100))) / BigInt(100);

    const feeData = await getProvider().getFeeData();

    const tx = await contract[method](...args, {
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    });

    const receipt = await tx.wait(2); // wait 2 confirmations
    return { tx, receipt };
};

// ── Step 2: Mint ERC-721 NFT ─────────────────────────────────────────────────

export const mintAssetNFT = async (assetId, metadataURI, ownerAddress) => {
    try {
        const signer = getSigner();
        const factory = new ethers.Contract(BLOCKCHAIN.contracts.nftFactory, NFT_FACTORY_ABI, signer);

        const assetIdBytes = ethers.encodeBytes32String(assetId.substring(0, 31));
        const { receipt } = await estimateAndSend(factory, "deployAssetNFT", [
            assetIdBytes,
            metadataURI,
            ownerAddress || signer.address,
        ]);

        // Parse event to get tokenId and contract address
        const event = receipt.logs
            .map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } })
            .find((e) => e?.name === "AssetNFTDeployed");

        if (!event) throw new Error("AssetNFTDeployed event not found in receipt");

        logger.info(`NFT minted — tokenId: ${event.args.tokenId}, contract: ${event.args.contractAddress}`);

        return {
            tokenId: event.args.tokenId.toString(),
            contractAddress: event.args.contractAddress,
            txHash: receipt.hash,
        };
    } catch (error) {
        logger.error("Mint NFT error:", error.message);
        throw new Error("NFT_MINT_FAILED: " + error.message);
    }
};

// ── Step 3: Deploy ERC-3643 Fractional Token Contract ───────────────────────

export const deployFractionalToken = async (assetTitle, assetId, totalFractions) => {
    try {
        const signer = getSigner();
        const factory = new ethers.Contract(
            BLOCKCHAIN.contracts.fractionalTokenFactory,
            FRACTIONAL_TOKEN_FACTORY_ABI,
            signer
        );

        const symbol = `LNK${assetId.substring(0, 4).toUpperCase()}`;
        const supplyWei = ethers.parseUnits(String(totalFractions), 0);

        const { receipt } = await estimateAndSend(factory, "deployFractionalToken", [
            assetTitle,
            symbol,
            supplyWei,
            BLOCKCHAIN.contracts.complianceModule,
            BLOCKCHAIN.contracts.identityRegistry,
        ]);

        const event = receipt.logs
            .map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } })
            .find((e) => e?.name === "FractionalTokenDeployed");

        if (!event) throw new Error("FractionalTokenDeployed event not found");

        logger.info(`ERC-3643 deployed at: ${event.args.contractAddress}`);

        return {
            contractAddress: event.args.contractAddress,
            txHash: receipt.hash,
        };
    } catch (error) {
        logger.error("Deploy ERC-3643 error:", error.message);
        throw new Error("ERC3643_DEPLOY_FAILED: " + error.message);
    }
};

// ── Step 4: Attach Compliance Rules ─────────────────────────────────────────

export const attachComplianceRules = async (erc3643Contract, jurisdictions, lockUpDays, eligibilityLevel) => {
    try {
        const signer = getSigner();
        const compliance = new ethers.Contract(
            BLOCKCHAIN.contracts.complianceModule,
            COMPLIANCE_MODULE_ABI,
            signer
        );

        // Convert ISO codes to bytes2
        const countryBytes = (jurisdictions || ["US", "GB", "SG"]).map((code) =>
            ethers.hexlify(ethers.toUtf8Bytes(code.substring(0, 2).padEnd(2, "\0")))
        );

        const levelMap = { RETAIL: 0, ACCREDITED: 1, PROFESSIONAL: 2 };
        const levelNum = levelMap[eligibilityLevel] ?? 0;

        const { receipt } = await estimateAndSend(compliance, "setJurisdictionRules", [
            erc3643Contract,
            countryBytes,
            levelNum,
        ]);

        logger.info(`Compliance rules attached — tx: ${receipt.hash}`);

        return { txHash: receipt.hash };
    } catch (error) {
        logger.error("Attach compliance error:", error.message);
        throw new Error("COMPLIANCE_ATTACH_FAILED: " + error.message);
    }
};

// ── Step 5: Issue Fractional Tokens to Platform Treasury ────────────────────

export const issueFractionalTokens = async (erc3643Contract, totalFractions) => {
    try {
        const signer = getSigner();
        const token = new ethers.Contract(erc3643Contract, FRACTIONAL_TOKEN_ABI, signer);

        // 49% tokenized goes to platform treasury wallet for investor purchases
        const fractionalAmount = BigInt(totalFractions);

        const { receipt } = await estimateAndSend(token, "mint", [
            BLOCKCHAIN.platformWalletAddress,
            fractionalAmount,
        ]);

        logger.info(`Fractions issued — ${totalFractions} tokens minted to treasury, tx: ${receipt.hash}`);

        return { txHash: receipt.hash };
    } catch (error) {
        logger.error("Issue fractions error:", error.message);
        throw new Error("FRACTION_ISSUE_FAILED: " + error.message);
    }
};

// ── Verify wallet on Identity Registry ──────────────────────────────────────

export const isWalletVerified = async (walletAddress) => {
    try {
        const provider = getProvider();
        const registry = new ethers.Contract(
            BLOCKCHAIN.contracts.identityRegistry,
            IDENTITY_REGISTRY_ABI,
            provider
        );
        return await registry.isVerified(walletAddress);
    } catch (error) {
        logger.error("isVerified check error:", error.message);
        return false;
    }
};
