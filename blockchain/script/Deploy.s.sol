// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ClaimTopicsRegistry}    from "../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry}       from "../src/compliance/IdentityRegistry.sol";
import {ComplianceModule}       from "../src/compliance/ComplianceModule.sol";
import {AssetNFT}               from "../src/tokens/AssetNFT.sol";
import {FractionalToken}        from "../src/tokens/FractionalToken.sol";
import {AssetNFTFactory}        from "../src/factories/AssetNFTFactory.sol";
import {FractionalTokenFactory} from "../src/factories/FractionalTokenFactory.sol";
import {EscrowMarketplace}      from "../src/marketplace/EscrowMarketplace.sol";
import {AuctionHouse}           from "../src/auction/AuctionHouse.sol";
import {GovernanceTimelock}     from "../src/governance/GovernanceTimelock.sol";

/**
 * @title Deploy
 * @notice Full platform deployment. Deploys all contracts as UUPS proxies,
 *         wires them together, and writes addresses to deployments/<network>.json.
 *
 * Usage:
 *   forge script script/Deploy.s.sol --rpc-url $AMOY_RPC_URL --broadcast --verify
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY    — deployment wallet private key
 *   PLATFORM_ADMIN          — Gnosis Safe / multisig address
 *   TRUSTED_ISSUER_WALLET   — backend KYC signer wallet (writes claims on-chain)
 *
 * Optional env vars (with defaults):
 *   PLATFORM_FEE_BPS        — marketplace + auction fee in bps (default: 250 = 2.5%)
 *   TIMELOCK_DELAY_SECONDS  — GovernanceTimelock delay in seconds (default: 172800 = 48h)
 *
 * ERC-20 payment tokens whitelisted at deploy time (per network):
 *   Polygon mainnet — USDC (native), USDC.e (bridged), USDT
 *   Sepolia         — Circle testnet USDC
 *   Amoy            — Circle testnet USDC
 *   Local           — none (ETH only; add manually via allowPaymentToken)
 */
contract Deploy is Script {
    address private _ctr;
    address private _tir;
    address private _ir;
    address private _cm;
    address private _nftFactory;
    address private _ftFactory;
    address private _escrow;
    address private _auction;
    address private _timelock;

    function run() external {
        uint256 deployerKey   = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin         = vm.envAddress("PLATFORM_ADMIN");
        address trustedIssuer = vm.envAddress("TRUSTED_ISSUER_WALLET");
        uint16  feeBps        = uint16(vm.envOr("PLATFORM_FEE_BPS", uint256(250)));
        uint256 timelockDelay = vm.envOr("TIMELOCK_DELAY_SECONDS", uint256(48 hours));

        // Pre-flight: catch misconfigured env vars before spending gas on partial deployment
        require(admin         != address(0), "Deploy: PLATFORM_ADMIN not set");
        require(admin.code.length > 0,        "Deploy: PLATFORM_ADMIN must be a contract (Gnosis Safe)");
        require(trustedIssuer != address(0), "Deploy: TRUSTED_ISSUER_WALLET not set");
        require(feeBps        <= 1000,       "Deploy: PLATFORM_FEE_BPS exceeds 10% max");
        require(timelockDelay >= 48 hours,   "Deploy: TIMELOCK_DELAY_SECONDS below MIN_DELAY (172800)");

        console2.log("=== LinkBlock Deploy ===");
        console2.log("Network:        ", block.chainid);
        console2.log("Admin:          ", admin);
        console2.log("Trusted issuer: ", trustedIssuer);
        console2.log("Fee bps:        ", feeBps);
        console2.log("Timelock delay: ", timelockDelay);

        vm.startBroadcast(deployerKey);

        // Timelock must be deployed first — its address is passed as upgradeAdmin to all platform contracts
        _deployTimelock(admin, timelockDelay);
        _deployCompliance(admin, trustedIssuer);
        _deployFactories(admin);
        _deployMarketplace(admin, feeBps);
        _deployAuction(admin, feeBps);

        // Wire venue contracts into the factory so every future token deployment
        // auto-registers them as agents for freeze/unfreeze on listing and auction.
        FractionalTokenFactory(payable(_ftFactory)).setVenueContracts(_escrow, _auction);
        console2.log("Venue contracts registered on factory");

        // Whitelist known stablecoins on both venue contracts so ERC-20 listings
        // and auctions work immediately after deploy without manual admin calls.
        _allowStablecoins();

        vm.stopBroadcast();

        _postDeployAssertions(admin, feeBps, timelockDelay);
        _writeRegistry();
    }

    // ── Step 1: compliance stack ──────────────────────────────────────────────

    function _deployCompliance(address admin, address trustedIssuer) internal {
        _ctr = _proxy(
            address(new ClaimTopicsRegistry()),
            abi.encodeWithSelector(ClaimTopicsRegistry.initialize.selector, admin, _timelock)
        );
        console2.log("ClaimTopicsRegistry:   ", _ctr);

        _tir = _proxy(
            address(new TrustedIssuersRegistry()),
            abi.encodeWithSelector(TrustedIssuersRegistry.initialize.selector, admin, _timelock)
        );
        console2.log("TrustedIssuersRegistry:", _tir);

        // Remove topic 2 (ACCREDITED_INVESTOR) from required topics.
        // Accredited/professional eligibility is enforced per-asset by ComplianceModule.setJurisdictionRules,
        // not as a universal KYC gate. Leaving topic 2 required with no issuer authorized to write it
        // would make isVerified() return false for every investor.
        ClaimTopicsRegistry(payable(_ctr)).removeClaimTopic(2);

        uint256[] memory topics = new uint256[](2);
        topics[0] = 1; // KYC_VERIFIED
        topics[1] = 3; // JURISDICTION_ELIGIBLE
        TrustedIssuersRegistry(payable(_tir)).addTrustedIssuer(trustedIssuer, topics);
        console2.log("Trusted issuer:        ", trustedIssuer);

        _ir = _proxy(
            address(new IdentityRegistry()),
            abi.encodeWithSelector(IdentityRegistry.initialize.selector, admin, _ctr, _tir, _timelock)
        );
        console2.log("IdentityRegistry:      ", _ir);

        _cm = _proxy(
            address(new ComplianceModule()),
            abi.encodeWithSelector(ComplianceModule.initialize.selector, admin, _ir, _timelock)
        );
        console2.log("ComplianceModule:      ", _cm);
    }

    // ── Step 2: token factories ───────────────────────────────────────────────

    function _deployFactories(address admin) internal {
        _nftFactory = _proxy(
            address(new AssetNFTFactory()),
            abi.encodeWithSelector(AssetNFTFactory.initialize.selector, admin, address(new AssetNFT()), _timelock)
        );
        console2.log("AssetNFTFactory:       ", _nftFactory);

        _ftFactory = _proxy(
            address(new FractionalTokenFactory()),
            abi.encodeWithSelector(
                FractionalTokenFactory.initialize.selector,
                admin,
                address(new FractionalToken()),
                _ir,
                _cm,
                _timelock
            )
        );
        console2.log("FractionalTokenFactory:", _ftFactory);
    }

    // ── Step 3: secondary market ─────────────────────────────────────────────

    function _deployMarketplace(address admin, uint16 feeBps) internal {
        _escrow = _proxy(
            address(new EscrowMarketplace()),
            abi.encodeWithSelector(EscrowMarketplace.initialize.selector, admin, feeBps, _timelock)
        );
        console2.log("EscrowMarketplace:     ", _escrow);
    }

    // ── Step 4: auction ───────────────────────────────────────────────────────

    function _deployAuction(address admin, uint16 feeBps) internal {
        _auction = _proxy(
            address(new AuctionHouse()),
            abi.encodeWithSelector(AuctionHouse.initialize.selector, admin, feeBps, _timelock)
        );
        console2.log("AuctionHouse:          ", _auction);
    }

    // ── Step 5: governance timelock ───────────────────────────────────────────

    function _deployTimelock(address admin, uint256 timelockDelay) internal {
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = admin; // Gnosis Safe schedules upgrades
        executors[0] = admin; // Gnosis Safe executes after delay

        _timelock = _proxy(
            address(new GovernanceTimelock()),
            abi.encodeWithSelector(
                GovernanceTimelock.initialize.selector,
                timelockDelay,
                proposers,
                executors
            )
        );
        console2.log("GovernanceTimelock:    ", _timelock);
    }

    // ── Post-deploy sanity checks ─────────────────────────────────────────────

    function _postDeployAssertions(address admin, uint16 feeBps, uint256 timelockDelay) internal view {
        // Verify each proxy initialized with the correct owner
        require(ClaimTopicsRegistry(payable(_ctr)).owner()         == admin, "Assert: CTR owner mismatch");
        require(TrustedIssuersRegistry(payable(_tir)).owner()      == admin, "Assert: TIR owner mismatch");
        require(IdentityRegistry(payable(_ir)).owner()             == admin, "Assert: IR owner mismatch");
        require(ComplianceModule(payable(_cm)).owner()             == admin, "Assert: CM owner mismatch");
        require(AssetNFTFactory(payable(_nftFactory)).owner()      == admin, "Assert: NFT factory owner mismatch");
        require(FractionalTokenFactory(payable(_ftFactory)).owner()== admin, "Assert: FT factory owner mismatch");
        require(EscrowMarketplace(payable(_escrow)).owner()        == admin, "Assert: Escrow owner mismatch");
        require(AuctionHouse(payable(_auction)).owner()            == admin, "Assert: Auction owner mismatch");

        // Verify timelock is wired as upgradeAdmin for every platform contract
        require(ClaimTopicsRegistry(payable(_ctr)).upgradeAdmin()         == _timelock, "Assert: CTR upgradeAdmin mismatch");
        require(TrustedIssuersRegistry(payable(_tir)).upgradeAdmin()      == _timelock, "Assert: TIR upgradeAdmin mismatch");
        require(IdentityRegistry(payable(_ir)).upgradeAdmin()             == _timelock, "Assert: IR upgradeAdmin mismatch");
        require(ComplianceModule(payable(_cm)).upgradeAdmin()             == _timelock, "Assert: CM upgradeAdmin mismatch");
        require(AssetNFTFactory(payable(_nftFactory)).upgradeAdmin()      == _timelock, "Assert: NFT factory upgradeAdmin mismatch");
        require(FractionalTokenFactory(payable(_ftFactory)).upgradeAdmin()== _timelock, "Assert: FT factory upgradeAdmin mismatch");
        require(EscrowMarketplace(payable(_escrow)).upgradeAdmin()        == _timelock, "Assert: Escrow upgradeAdmin mismatch");
        require(AuctionHouse(payable(_auction)).upgradeAdmin()            == _timelock, "Assert: Auction upgradeAdmin mismatch");

        // Verify fee configuration
        require(EscrowMarketplace(payable(_escrow)).platformFeeBps()  == feeBps, "Assert: Escrow fee mismatch");
        require(AuctionHouse(payable(_auction)).platformFeeBps()      == feeBps, "Assert: Auction fee mismatch");

        // Verify timelock delay
        require(GovernanceTimelock(payable(_timelock)).getMinDelay() >= timelockDelay, "Assert: Timelock delay mismatch");

        // Verify compliance wiring
        require(address(ComplianceModule(payable(_cm)).identityRegistry()) == _ir, "Assert: CM IR mismatch");

        // Verify venue contracts are wired into the factory
        require(FractionalTokenFactory(payable(_ftFactory)).escrowMarketplace() == _escrow,  "Assert: factory escrow mismatch");
        require(FractionalTokenFactory(payable(_ftFactory)).auctionHouse()      == _auction, "Assert: factory auction mismatch");

        // Verify all stablecoins are whitelisted on both venue contracts
        address[] memory stables = _stablecoinAddresses();
        for (uint256 i = 0; i < stables.length; i++) {
            require(EscrowMarketplace(payable(_escrow)).isPaymentTokenAllowed(stables[i]), "Assert: Escrow missing stablecoin");
            require(AuctionHouse(payable(_auction)).isPaymentTokenAllowed(stables[i]),     "Assert: Auction missing stablecoin");
        }

        console2.log("=== All post-deploy assertions passed ===");
    }

    // ── Write deployment registry ─────────────────────────────────────────────

    function _writeRegistry() internal {
        string memory net  = _chainName();
        string memory path = string(abi.encodePacked("deployments/", net, ".json"));

        string memory json = string(abi.encodePacked(
            '{\n',
            '  "network": "',                net,                       '",\n',
            '  "ClaimTopicsRegistry": "',    vm.toString(_ctr),         '",\n',
            '  "TrustedIssuersRegistry": "', vm.toString(_tir),         '",\n',
            '  "IdentityRegistry": "',       vm.toString(_ir),          '",\n',
            '  "ComplianceModule": "',       vm.toString(_cm),          '",\n',
            '  "AssetNFTFactory": "',        vm.toString(_nftFactory),  '",\n',
            '  "FractionalTokenFactory": "', vm.toString(_ftFactory),   '",\n',
            '  "EscrowMarketplace": "',      vm.toString(_escrow),      '",\n',
            '  "AuctionHouse": "',           vm.toString(_auction),     '",\n',
            '  "GovernanceTimelock": "',     vm.toString(_timelock),    '"\n',
            '}'
        ));

        vm.writeFile(path, json);
        console2.log("Addresses written to:", path);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _proxy(address impl, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(impl, initData));
    }

    function _chainName() internal view returns (string memory) {
        uint256 id = block.chainid;
        if (id == 80002)    return "amoy";
        if (id == 137)      return "polygon";
        if (id == 11155111) return "sepolia";
        if (id == 1)        return "mainnet";
        return "local";
    }

    // ── Step 6: whitelist stablecoins on venue contracts ──────────────────────

    function _allowStablecoins() internal {
        address[] memory tokens = _stablecoinAddresses();
        if (tokens.length == 0) {
            console2.log("No stablecoins to whitelist on this network (ETH only)");
            return;
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            EscrowMarketplace(payable(_escrow)).allowPaymentToken(tokens[i]);
            AuctionHouse(payable(_auction)).allowPaymentToken(tokens[i]);
            console2.log("Payment token whitelisted:", tokens[i]);
        }
    }

    /**
     * @dev Returns canonical stablecoin addresses for the current network.
     *      address(0) entries are never included — only real, deployed tokens.
     *      Local/unknown networks return an empty array (ETH-only mode).
     */
    function _stablecoinAddresses() internal view returns (address[] memory tokens) {
        uint256 id = block.chainid;

        if (id == 137) {
            // Polygon PoS mainnet
            tokens = new address[](3);
            tokens[0] = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359; // USDC  (native, Circle)
            tokens[1] = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174; // USDC.e (bridged, Polygon)
            tokens[2] = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F; // USDT  (Tether on Polygon)
        } else if (id == 11155111) {
            // Sepolia testnet — Circle's official testnet USDC
            tokens = new address[](1);
            tokens[0] = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        } else if (id == 80002) {
            // Polygon Amoy testnet — Circle's CCTP testnet USDC
            tokens = new address[](1);
            tokens[0] = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582;
        } else {
            // Local / unknown — return empty; admin must whitelist manually
            tokens = new address[](0);
        }
    }
}
