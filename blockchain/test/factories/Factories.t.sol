// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ClaimTopicsRegistry} from "../../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry} from "../../src/compliance/IdentityRegistry.sol";
import {ComplianceModule} from "../../src/compliance/ComplianceModule.sol";
import {AssetNFT} from "../../src/tokens/AssetNFT.sol";
import {FractionalToken} from "../../src/tokens/FractionalToken.sol";
import {AssetNFTFactory} from "../../src/factories/AssetNFTFactory.sol";
import {FractionalTokenFactory} from "../../src/factories/FractionalTokenFactory.sol";

contract FactoriesTest is Test {
    IdentityRegistry       internal ir;
    ComplianceModule       internal cm;
    AssetNFTFactory        internal nftFactory;
    FractionalTokenFactory internal ftFactory;

    address internal admin    = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal user     = makeAddr("user");

    bytes32 internal ASSET1  = keccak256("asset-001");
    bytes32 internal ASSET2  = keccak256("asset-002");
    string  internal URI     = "ipfs://QmTest/metadata.json";
    uint256 internal SUPPLY  = 490_000e18;

    function setUp() public {
        vm.startPrank(admin);

        ClaimTopicsRegistry ctr = ClaimTopicsRegistry(payable(address(new ERC1967Proxy(
            address(new ClaimTopicsRegistry()),
            abi.encodeWithSelector(ClaimTopicsRegistry.initialize.selector, admin)
        ))));

        TrustedIssuersRegistry tir = TrustedIssuersRegistry(payable(address(new ERC1967Proxy(
            address(new TrustedIssuersRegistry()),
            abi.encodeWithSelector(TrustedIssuersRegistry.initialize.selector, admin)
        ))));

        ir = IdentityRegistry(payable(address(new ERC1967Proxy(
            address(new IdentityRegistry()),
            abi.encodeWithSelector(IdentityRegistry.initialize.selector, admin, address(ctr), address(tir))
        ))));

        cm = ComplianceModule(payable(address(new ERC1967Proxy(
            address(new ComplianceModule()),
            abi.encodeWithSelector(ComplianceModule.initialize.selector, admin, address(ir))
        ))));

        nftFactory = AssetNFTFactory(payable(address(new ERC1967Proxy(
            address(new AssetNFTFactory()),
            abi.encodeWithSelector(AssetNFTFactory.initialize.selector, admin, address(new AssetNFT()))
        ))));

        ftFactory = FractionalTokenFactory(payable(address(new ERC1967Proxy(
            address(new FractionalTokenFactory()),
            abi.encodeWithSelector(
                FractionalTokenFactory.initialize.selector,
                admin,
                address(new FractionalToken()),
                address(ir),
                address(cm)
            )
        ))));

        vm.stopPrank();
    }

    // AssetNFTFactory
    function test_ANFTF_Initialize() public view {
        assertEq(nftFactory.owner(), admin);
        assertEq(nftFactory.nextTokenId(), 1);
        assertTrue(nftFactory.implementation() != address(0));
    }

    function test_ANFTF_DeployAssetNFT() public {
        vm.prank(admin);
        (uint256 tokenId, address nftContract) = nftFactory.deployAssetNFT(ASSET1, URI, treasury);

        assertEq(tokenId, 1);
        assertTrue(nftContract != address(0));
        assertEq(nftFactory.deployedNFT(ASSET1), nftContract);
        assertEq(nftFactory.nextTokenId(), 2);

        AssetNFT nft = AssetNFT(payable(nftContract));
        assertEq(nft.ownerOf(tokenId), treasury);
        assertEq(nft.tokenURI(tokenId), URI);
        assertEq(nft.owner(), admin); // ownership transferred from factory to admin
    }

    function test_ANFTF_DeployAssetNFT_IncrementingIds() public {
        vm.startPrank(admin);
        (uint256 id1,) = nftFactory.deployAssetNFT(ASSET1, URI, treasury);
        (uint256 id2,) = nftFactory.deployAssetNFT(ASSET2, URI, treasury);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(nftFactory.getAllDeployments().length, 2);
    }

    function test_ANFTF_Deploy_DuplicateAssetId_Reverts() public {
        vm.startPrank(admin);
        nftFactory.deployAssetNFT(ASSET1, URI, treasury);
        vm.expectRevert("ANFTF: asset already tokenized");
        nftFactory.deployAssetNFT(ASSET1, URI, treasury);
        vm.stopPrank();
    }

    function test_ANFTF_Deploy_EmptyAssetId_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("ANFTF: empty assetId");
        nftFactory.deployAssetNFT(bytes32(0), URI, treasury);
    }

    function test_ANFTF_Deploy_EmptyURI_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("ANFTF: empty metadata URI");
        nftFactory.deployAssetNFT(ASSET1, "", treasury);
    }

    function test_ANFTF_Deploy_ZeroOwner_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("ANFTF: zero owner");
        nftFactory.deployAssetNFT(ASSET1, URI, address(0));
    }

    function test_ANFTF_Deploy_OnlyOwner_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        nftFactory.deployAssetNFT(ASSET1, URI, treasury);
    }

    function test_ANFTF_SetImplementation() public {
        address newImpl = address(new AssetNFT());
        vm.prank(admin);
        nftFactory.setImplementation(newImpl);
        assertEq(nftFactory.implementation(), newImpl);
    }

    function test_ANFTF_SetImplementation_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("ANFTF: zero implementation");
        nftFactory.setImplementation(address(0));
    }

    function test_ANFTF_GetAllDeployments_Empty() public view {
        assertEq(nftFactory.getAllDeployments().length, 0);
    }

    function test_ANFTF_Pause_BlocksDeploy() public {
        vm.prank(admin);
        nftFactory.pause();

        vm.prank(admin);
        vm.expectRevert();
        nftFactory.deployAssetNFT(ASSET1, URI, treasury);
    }

    function test_ANFTF_Unpause_AllowsDeploy() public {
        vm.startPrank(admin);
        nftFactory.pause();
        nftFactory.unpause();
        (uint256 tokenId,) = nftFactory.deployAssetNFT(ASSET1, URI, treasury);
        vm.stopPrank();
        assertEq(tokenId, 1);
    }

    // FractionalTokenFactory
    function test_FTFAC_Initialize() public view {
        assertEq(ftFactory.owner(), admin);
        assertEq(ftFactory.identityRegistry(), address(ir));
        assertEq(ftFactory.complianceModule(), address(cm));
        assertTrue(ftFactory.implementation() != address(0));
    }

    function test_FTFAC_DeployFractionalToken() public {
        vm.prank(admin);
        address tokenContract = ftFactory.deployFractionalToken(
            "LinkBlock Asset Fractions",
            "LBF001",
            SUPPLY,
            ASSET1,
            treasury
        );

        assertTrue(tokenContract != address(0));
        assertEq(ftFactory.deployedToken(ASSET1), tokenContract);

        FractionalToken ft = FractionalToken(payable(tokenContract));
        assertEq(ft.totalSupply(), SUPPLY);
        assertEq(ft.balanceOf(treasury), SUPPLY);
        assertEq(ft.assetId(), ASSET1);
        assertEq(ft.owner(), admin); // ownership transferred to factory owner
    }

    function test_FTFAC_Deploy_MultipleTimes() public {
        vm.startPrank(admin);
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, treasury);
        ftFactory.deployFractionalToken("Token2", "TK2", SUPPLY, ASSET2, treasury);
        vm.stopPrank();

        assertEq(ftFactory.getAllDeployments().length, 2);
    }

    function test_FTFAC_Deploy_DuplicateAssetId_Reverts() public {
        vm.startPrank(admin);
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, treasury);
        vm.expectRevert("FTFAC: token already deployed");
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, treasury);
        vm.stopPrank();
    }

    function test_FTFAC_Deploy_EmptyName_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: empty name");
        ftFactory.deployFractionalToken("", "TK1", SUPPLY, ASSET1, treasury);
    }

    function test_FTFAC_Deploy_EmptySymbol_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: empty symbol");
        ftFactory.deployFractionalToken("Token1", "", SUPPLY, ASSET1, treasury);
    }

    function test_FTFAC_Deploy_ZeroSupply_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: zero supply");
        ftFactory.deployFractionalToken("Token1", "TK1", 0, ASSET1, treasury);
    }

    function test_FTFAC_Deploy_EmptyAssetId_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: empty assetId");
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, bytes32(0), treasury);
    }

    function test_FTFAC_Deploy_ZeroTreasury_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: zero treasury");
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, address(0));
    }

    function test_FTFAC_Deploy_OnlyOwner_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, treasury);
    }

    function test_FTFAC_SetImplementation() public {
        address newImpl = address(new FractionalToken());
        vm.prank(admin);
        ftFactory.setImplementation(newImpl);
        assertEq(ftFactory.implementation(), newImpl);
    }

    function test_FTFAC_SetImplementation_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: zero implementation");
        ftFactory.setImplementation(address(0));
    }

    function test_FTFAC_GetAllDeployments_Empty() public view {
        assertEq(ftFactory.getAllDeployments().length, 0);
    }

    function test_FTFAC_Pause_BlocksDeploy() public {
        vm.prank(admin);
        ftFactory.pause();

        vm.prank(admin);
        vm.expectRevert();
        ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, treasury);
    }

    function test_FTFAC_Unpause_AllowsDeploy() public {
        vm.startPrank(admin);
        ftFactory.pause();
        ftFactory.unpause();
        address tokenContract = ftFactory.deployFractionalToken("Token1", "TK1", SUPPLY, ASSET1, treasury);
        vm.stopPrank();
        assertTrue(tokenContract != address(0));
    }

    // ETH rejection
    function test_ANFTF_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(nftFactory).call{value: 1 ether}("");
        assertFalse(success);
    }

    function test_FTFAC_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(ftFactory).call{value: 1 ether}("");
        assertFalse(success);
    }

    //  _authorizeUpgrade hardening  -  AssetNFTFactory 

    function test_ANFTF_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("ANFTF: zero implementation");
        nftFactory.upgradeToAndCall(address(0), "");
    }

    function test_ANFTF_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("ANFTF: not a contract");
        nftFactory.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_ANFTF_Upgrade_Success() public {
        AssetNFTFactory newImpl = new AssetNFTFactory();
        vm.prank(admin);
        nftFactory.upgradeToAndCall(address(newImpl), "");
        assertEq(nftFactory.owner(), admin);
    }

    //  _authorizeUpgrade hardening  -  FractionalTokenFactory 

    function test_FTFAC_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: zero implementation");
        ftFactory.upgradeToAndCall(address(0), "");
    }

    function test_FTFAC_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FTFAC: not a contract");
        ftFactory.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_FTFAC_Upgrade_Success() public {
        FractionalTokenFactory newImpl = new FractionalTokenFactory();
        vm.prank(admin);
        ftFactory.upgradeToAndCall(address(newImpl), "");
        assertEq(ftFactory.owner(), admin);
    }
}
