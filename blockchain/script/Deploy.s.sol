// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ClaimTopicsRegistry} from "../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry} from "../src/compliance/IdentityRegistry.sol";
import {ComplianceModule} from "../src/compliance/ComplianceModule.sol";
import {AssetNFT} from "../src/tokens/AssetNFT.sol";
import {FractionalToken} from "../src/tokens/FractionalToken.sol";
import {AssetNFTFactory} from "../src/factories/AssetNFTFactory.sol";
import {FractionalTokenFactory} from "../src/factories/FractionalTokenFactory.sol";

/**
 * @title Deploy
 * @notice Full platform deployment script. Deploys all contracts as UUPS proxies,
 *         wires them together, and writes addresses to deployments/<network>.json.
 *
 * Usage:
 *   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
 *   forge script script/Deploy.s.sol --rpc-url $AMOY_RPC_URL    --broadcast --verify
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY    -  deployment wallet
 *   PLATFORM_ADMIN          -  multisig / gnosis safe address
 *   TRUSTED_ISSUER_WALLET   -  backend signer wallet (writes KYC claims on-chain)
 */
contract Deploy is Script {
    // Deployed addresses  -  set by internal helpers, read by run() for registry write
    address private _ctr;
    address private _tir;
    address private _ir;
    address private _cm;
    address private _nftFactory;
    address private _ftFactory;

    function run() external {
        uint256 deployerKey   = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin         = vm.envAddress("PLATFORM_ADMIN");
        address trustedIssuer = vm.envAddress("TRUSTED_ISSUER_WALLET");

        vm.startBroadcast(deployerKey);
        _deployCompliance(admin, trustedIssuer);
        _deployFactories(admin);
        vm.stopBroadcast();

        _writeRegistry();
    }

    //  Step 1: compliance stack 

    function _deployCompliance(address admin, address trustedIssuer) internal {
        _ctr = _deployProxy(
            address(new ClaimTopicsRegistry()),
            abi.encodeWithSelector(ClaimTopicsRegistry.initialize.selector, admin)
        );
        console2.log("ClaimTopicsRegistry:", _ctr);

        _tir = _deployProxy(
            address(new TrustedIssuersRegistry()),
            abi.encodeWithSelector(TrustedIssuersRegistry.initialize.selector, admin)
        );
        console2.log("TrustedIssuersRegistry:", _tir);

        _registerIssuer(trustedIssuer);

        _ir = _deployProxy(
            address(new IdentityRegistry()),
            abi.encodeWithSelector(IdentityRegistry.initialize.selector, admin, _ctr, _tir)
        );
        console2.log("IdentityRegistry:", _ir);

        _cm = _deployProxy(
            address(new ComplianceModule()),
            abi.encodeWithSelector(ComplianceModule.initialize.selector, admin, _ir)
        );
        console2.log("ComplianceModule:", _cm);
    }

    function _registerIssuer(address trustedIssuer) internal {
        uint256[] memory topics = new uint256[](2);
        topics[0] = 1; // KYC_VERIFIED
        topics[1] = 3; // JURISDICTION_ELIGIBLE
        TrustedIssuersRegistry(payable(_tir)).addTrustedIssuer(trustedIssuer, topics);
        console2.log("Registered trusted issuer:", trustedIssuer);
    }

    //  Step 2: factories 

    function _deployFactories(address admin) internal {
        _deployAssetNFTFactory(admin);
        _deployFractionalTokenFactory(admin);
    }

    function _deployAssetNFTFactory(address admin) internal {
        address impl = address(new AssetNFT());
        _nftFactory = _deployProxy(
            address(new AssetNFTFactory()),
            abi.encodeWithSelector(AssetNFTFactory.initialize.selector, admin, impl)
        );
        console2.log("AssetNFTFactory:", _nftFactory);
    }

    function _deployFractionalTokenFactory(address admin) internal {
        address impl = address(new FractionalToken());
        _ftFactory = _deployProxy(
            address(new FractionalTokenFactory()),
            abi.encodeWithSelector(
                FractionalTokenFactory.initialize.selector,
                admin,
                impl,
                _ir,
                _cm
            )
        );
        console2.log("FractionalTokenFactory:", _ftFactory);
    }

    // Registry write
    function _writeRegistry() internal {
        string memory chainName = _chainName();
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "ClaimTopicsRegistry": "',    vm.toString(_ctr),        '",\n',
            '  "TrustedIssuersRegistry": "', vm.toString(_tir),        '",\n',
            '  "IdentityRegistry": "',       vm.toString(_ir),         '",\n',
            '  "ComplianceModule": "',       vm.toString(_cm),         '",\n',
            '  "AssetNFTFactory": "',        vm.toString(_nftFactory), '",\n',
            '  "FractionalTokenFactory": "', vm.toString(_ftFactory),  '",\n',
            '  "EscrowContract": "",\n',
            '  "AuctionFactory": "",\n',
            '  "TimelockController": "",\n',
            '  "GnosisSafe": ""\n',
            '}'
        ));
        vm.writeFile(string(abi.encodePacked("deployments/", chainName, ".json")), json);
        console2.log("Registry written to deployments/", chainName, ".json");
    }

    // Helpers
    function _deployProxy(address impl, bytes memory initData) internal returns (address) {
        return address(new ERC1967Proxy(impl, initData));
    }

    function _chainName() internal view returns (string memory) {
        uint256 id = block.chainid;
        if (id == 11155111) return "sepolia";
        if (id == 80002)    return "amoy";
        if (id == 137)      return "mainnet";
        return "local";
    }
}
