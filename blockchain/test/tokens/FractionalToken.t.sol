// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ClaimTopicsRegistry} from "../../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry} from "../../src/compliance/IdentityRegistry.sol";
import {ComplianceModule} from "../../src/compliance/ComplianceModule.sol";
import {FractionalToken} from "../../src/tokens/FractionalToken.sol";

contract FractionalTokenTest is Test {
    ClaimTopicsRegistry    internal ctr;
    TrustedIssuersRegistry internal tir;
    IdentityRegistry       internal ir;
    ComplianceModule       internal cm;
    FractionalToken        internal ft;

    address internal admin     = makeAddr("admin");
    address internal issuer    = makeAddr("issuer");
    address internal treasury  = makeAddr("treasury");
    address internal investor1 = makeAddr("investor1");
    address internal investor2 = makeAddr("investor2");
    address internal agent     = makeAddr("agent");

    bytes32 internal ASSET_ID = keccak256("asset-001");
    uint256 internal SUPPLY   = 1_000_000e18;

    function setUp() public {
        uint256[] memory issuerTopics = new uint256[](2);
        issuerTopics[0] = 1;
        issuerTopics[1] = 3;

        vm.startPrank(admin);

        // CTR  -  remove topic 2 so only topics 1+3 are required
        ctr = ClaimTopicsRegistry(payable(address(new ERC1967Proxy(
            address(new ClaimTopicsRegistry()),
            abi.encodeWithSelector(ClaimTopicsRegistry.initialize.selector, admin)
        ))));
        ctr.removeClaimTopic(2);

        // TIR
        tir = TrustedIssuersRegistry(payable(address(new ERC1967Proxy(
            address(new TrustedIssuersRegistry()),
            abi.encodeWithSelector(TrustedIssuersRegistry.initialize.selector, admin)
        ))));
        tir.addTrustedIssuer(issuer, issuerTopics);

        // IR
        ir = IdentityRegistry(payable(address(new ERC1967Proxy(
            address(new IdentityRegistry()),
            abi.encodeWithSelector(IdentityRegistry.initialize.selector, admin, address(ctr), address(tir))
        ))));

        // CM
        cm = ComplianceModule(payable(address(new ERC1967Proxy(
            address(new ComplianceModule()),
            abi.encodeWithSelector(ComplianceModule.initialize.selector, admin, address(ir))
        ))));

        // FractionalToken
        ft = FractionalToken(payable(address(new ERC1967Proxy(
            address(new FractionalToken()),
            abi.encodeWithSelector(
                FractionalToken.initialize.selector,
                "LinkBlock Asset Fractions",
                "LBF001",
                SUPPLY,
                ASSET_ID,
                address(ir),
                address(cm),
                admin
            )
        ))));

        ft.mintInitialSupply(treasury, SUPPLY);
        vm.stopPrank();

        _verifyWallet(treasury);
        _verifyWallet(investor1);
        _verifyWallet(investor2);
    }

    function _verifyWallet(address wallet) internal {
        vm.startPrank(issuer);
        ir.addIdentity(wallet, keccak256(abi.encodePacked(wallet)));
        ir.addClaim(wallet, 1, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        ir.addClaim(wallet, 3, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        vm.stopPrank();
    }

    function _freshToken() internal returns (FractionalToken) {
        vm.prank(admin);
        return FractionalToken(payable(address(new ERC1967Proxy(
            address(new FractionalToken()),
            abi.encodeWithSelector(
                FractionalToken.initialize.selector,
                "Test", "TST", SUPPLY,
                keccak256(abi.encodePacked(block.timestamp)),
                address(ir), address(cm), admin
            )
        ))));
    }

    // Initialize
    function test_Initialize() public view {
        assertEq(ft.name(), "LinkBlock Asset Fractions");
        assertEq(ft.symbol(), "LBF001");
        assertEq(ft.totalSupplyCap(), SUPPLY);
        assertEq(ft.assetId(), ASSET_ID);
        assertEq(ft.owner(), admin);
    }

    // Mint
    function test_MintInitialSupply_Success() public view {
        assertEq(ft.balanceOf(treasury), SUPPLY);
        assertEq(ft.totalSupply(), SUPPLY);
        assertTrue(ft.supplyMinted());
    }

    function test_MintInitialSupply_AlreadyMinted_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: supply already minted");
        ft.mintInitialSupply(treasury, SUPPLY);
    }

    function test_MintInitialSupply_ZeroTreasury_Reverts() public {
        FractionalToken ft2 = _freshToken();
        vm.prank(admin);
        vm.expectRevert("FT: zero treasury");
        ft2.mintInitialSupply(address(0), SUPPLY);
    }

    function test_MintInitialSupply_WrongAmount_Reverts() public {
        FractionalToken ft2 = _freshToken();
        vm.prank(admin);
        vm.expectRevert("FT: amount must equal supply cap");
        ft2.mintInitialSupply(treasury, SUPPLY - 1);
    }

    function test_MintInitialSupply_OnlyOwner_Reverts() public {
        FractionalToken ft2 = _freshToken();
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        ft2.mintInitialSupply(treasury, SUPPLY);
    }

    // Transfer
    function test_Transfer_BothVerified() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        assertEq(ft.balanceOf(investor1), 1000e18);
        assertEq(ft.balanceOf(treasury), SUPPLY - 1000e18);
    }

    function test_Transfer_SenderNotVerified_Reverts() public {
        vm.prank(issuer);
        ir.removeIdentity(treasury);

        vm.prank(treasury);
        vm.expectRevert("CM: sender not KYC verified");
        ft.transfer(investor1, 1000e18);
    }

    function test_Transfer_RecipientNotVerified_Reverts() public {
        address stranger = makeAddr("stranger");
        vm.prank(treasury);
        vm.expectRevert("CM: recipient not KYC verified");
        ft.transfer(stranger, 1000e18);
    }

    // Freeze / Unfreeze
    function test_FreezeTokens_Success() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        ft.addAgent(agent);

        vm.prank(agent);
        ft.freezeTokens(investor1, 400e18);

        assertEq(ft.frozenTokens(investor1), 400e18);
        assertEq(ft.availableBalance(investor1), 600e18);
    }

    function test_FreezeTokens_BlocksTransfer() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        ft.addAgent(agent);

        vm.prank(agent);
        ft.freezeTokens(investor1, 900e18);

        vm.prank(investor1);
        vm.expectRevert("FT: insufficient unfrozen balance");
        ft.transfer(investor2, 200e18);
    }

    function test_UnfreezeTokens_Success() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        ft.addAgent(agent);

        vm.prank(agent);
        ft.freezeTokens(investor1, 500e18);

        vm.prank(agent);
        ft.unfreezeTokens(investor1, 300e18);

        assertEq(ft.frozenTokens(investor1), 200e18);
        assertEq(ft.availableBalance(investor1), 800e18);
    }

    function test_FreezeTokens_ExceedsBalance_Reverts() public {
        vm.prank(treasury);
        ft.transfer(investor1, 100e18);

        vm.prank(admin);
        ft.addAgent(agent);

        vm.prank(agent);
        vm.expectRevert("FT: freeze exceeds balance");
        ft.freezeTokens(investor1, 200e18);
    }

    function test_UnfreezeTokens_InsufficientFrozen_Reverts() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        ft.addAgent(agent);

        vm.prank(agent);
        ft.freezeTokens(investor1, 100e18);

        vm.prank(agent);
        vm.expectRevert("FT: insufficient frozen balance");
        ft.unfreezeTokens(investor1, 200e18);
    }

    function test_FreezeTokens_OnlyAgent_Reverts() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert("FT: caller not agent");
        ft.freezeTokens(investor1, 100e18);
    }

    function test_FreezeTokens_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero wallet");
        ft.freezeTokens(address(0), 100e18);
    }

    function test_FreezeTokens_ZeroAmount_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero amount");
        ft.freezeTokens(investor1, 0);
    }

    function test_UnfreezeTokens_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero wallet");
        ft.unfreezeTokens(address(0), 100e18);
    }

    function test_UnfreezeTokens_ZeroAmount_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero amount");
        ft.unfreezeTokens(investor1, 0);
    }

    // Forced transfer
    function test_ForcedTransfer_Success() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        ft.forcedTransfer(investor1, investor2, 500e18);

        assertEq(ft.balanceOf(investor1), 500e18);
        assertEq(ft.balanceOf(investor2), 500e18);
    }

    function test_ForcedTransfer_MovesPartialFrozen() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        ft.addAgent(agent);

        vm.prank(agent);
        ft.freezeTokens(investor1, 800e18);

        // frozen reduces from 800e18 to 200e18 after deducting 600e18
        vm.prank(admin);
        ft.forcedTransfer(investor1, investor2, 600e18);

        assertEq(ft.frozenTokens(investor1), 200e18);
        assertEq(ft.balanceOf(investor2), 600e18);
    }

    function test_ForcedTransfer_RecipientNotVerified_Reverts() public {
        address stranger = makeAddr("stranger");
        vm.prank(admin);
        vm.expectRevert("FT: recipient not KYC verified");
        ft.forcedTransfer(treasury, stranger, 100e18);
    }

    function test_ForcedTransfer_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero address");
        ft.forcedTransfer(address(0), investor1, 100e18);
    }

    function test_ForcedTransfer_ZeroAmount_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero amount");
        ft.forcedTransfer(treasury, investor1, 0);
    }

    function test_ForcedTransfer_InsufficientBalance_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: insufficient balance");
        ft.forcedTransfer(investor1, investor2, 100e18); // investor1 has 0
    }

    function test_ForcedTransfer_OnlyOwner_Reverts() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        ft.forcedTransfer(treasury, investor1, 100e18);
    }

    // Agents
    function test_AddAgent_RemoveAgent() public {
        vm.startPrank(admin);
        ft.addAgent(agent);
        assertTrue(ft.isAgent(agent));
        ft.removeAgent(agent);
        assertFalse(ft.isAgent(agent));
        vm.stopPrank();
    }

    function test_AddAgent_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero address");
        ft.addAgent(address(0));
    }

    function test_AddAgent_OnlyOwner_Reverts() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        ft.addAgent(agent);
    }

    // Compliance module update
    function test_SetComplianceModule_Success() public {
        vm.prank(admin);
        ft.setComplianceModule(address(cm));
        assertEq(address(ft.complianceModule()), address(cm));
    }

    function test_SetComplianceModule_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero module");
        ft.setComplianceModule(address(0));
    }

    // Pause
    function test_Pause_BlocksTransfer() public {
        vm.prank(admin);
        ft.pause();

        vm.prank(treasury);
        vm.expectRevert();
        ft.transfer(investor1, 100e18);
    }

    function test_Unpause_AllowsTransfer() public {
        vm.startPrank(admin);
        ft.pause();
        ft.unpause();
        vm.stopPrank();

        vm.prank(treasury);
        ft.transfer(investor1, 100e18);
        assertEq(ft.balanceOf(investor1), 100e18);
    }

    //  Lock-up via ComplianceModule 

    function test_LockUp_BlocksTransfer() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        cm.addAgent(agent);

        // Lock-up is keyed by token contract (msg.sender inside isTransferValid = address(ft))
        vm.prank(agent);
        cm.setLockUp(address(ft), investor1, block.timestamp + 30 days);

        vm.prank(investor1);
        vm.expectRevert("CM: sender tokens locked");
        ft.transfer(investor2, 100e18);
    }

    function test_LockUp_Expires_AllowsTransfer() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        cm.setLockUp(address(ft), investor1, block.timestamp + 100);

        vm.warp(block.timestamp + 101);

        vm.prank(investor1);
        ft.transfer(investor2, 100e18);
        assertEq(ft.balanceOf(investor2), 100e18);
    }

    // Jurisdiction blocking
    function test_JurisdictionBlocked_Reverts() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        // Only GB allowed; investor2 has "US" claim
        bytes2[] memory jurs = new bytes2[](1);
        jurs[0] = bytes2("GB");
        vm.prank(admin);
        cm.setJurisdictionRules(ASSET_ID, jurs, ComplianceModule.EligibilityLevel.RETAIL);

        vm.prank(investor1);
        vm.expectRevert("CM: recipient jurisdiction not allowed");
        ft.transfer(investor2, 100e18);
    }

    function test_JurisdictionAllowed_Succeeds() public {
        vm.prank(treasury);
        ft.transfer(investor1, 1000e18);

        bytes2[] memory jurs = new bytes2[](1);
        jurs[0] = bytes2("US");
        vm.prank(admin);
        cm.setJurisdictionRules(ASSET_ID, jurs, ComplianceModule.EligibilityLevel.RETAIL);

        vm.prank(investor1);
        ft.transfer(investor2, 100e18);
        assertEq(ft.balanceOf(investor2), 100e18);
    }

    // ETH rejection
    function test_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(ft).call{value: 1 ether}("");
        assertFalse(success);
    }

    //  setComplianceModule code-length check 

    function test_SetComplianceModule_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: not a contract");
        ft.setComplianceModule(makeAddr("eoa"));
    }

    // _authorizeUpgrade hardening
    function test_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: zero implementation");
        ft.upgradeToAndCall(address(0), "");
    }

    function test_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("FT: not a contract");
        ft.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_Upgrade_Success() public {
        FractionalToken newImpl = new FractionalToken();
        vm.prank(admin);
        ft.upgradeToAndCall(address(newImpl), "");
        assertEq(ft.assetId(), ASSET_ID);
        assertEq(ft.totalSupply(), SUPPLY);
    }
}
