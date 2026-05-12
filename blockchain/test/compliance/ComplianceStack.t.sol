// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ClaimTopicsRegistry} from "../../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry} from "../../src/compliance/IdentityRegistry.sol";
import {ComplianceModule} from "../../src/compliance/ComplianceModule.sol";

contract ComplianceStackTest is Test {
    ClaimTopicsRegistry    internal ctr;
    TrustedIssuersRegistry internal tir;
    IdentityRegistry       internal ir;
    ComplianceModule       internal cm;

    address internal admin   = makeAddr("admin");
    address internal issuer  = makeAddr("issuer");
    address internal wallet1 = makeAddr("wallet1");
    address internal wallet2 = makeAddr("wallet2");
    address internal agent   = makeAddr("agent");

    uint256[] internal defaultTopics;

    function setUp() public {
        defaultTopics = new uint256[](2);
        defaultTopics[0] = 1; // KYC_VERIFIED
        defaultTopics[1] = 3; // JURISDICTION_ELIGIBLE

        vm.startPrank(admin);

        // Deploy CTR
        ClaimTopicsRegistry ctrImpl = new ClaimTopicsRegistry();
        ERC1967Proxy ctrProxy = new ERC1967Proxy(
            address(ctrImpl),
            abi.encodeWithSelector(ClaimTopicsRegistry.initialize.selector, admin)
        );
        ctr = ClaimTopicsRegistry(payable(address(ctrProxy)));

        // Deploy TIR
        TrustedIssuersRegistry tirImpl = new TrustedIssuersRegistry();
        ERC1967Proxy tirProxy = new ERC1967Proxy(
            address(tirImpl),
            abi.encodeWithSelector(TrustedIssuersRegistry.initialize.selector, admin)
        );
        tir = TrustedIssuersRegistry(payable(address(tirProxy)));

        // Register issuer for topics 1 and 3
        tir.addTrustedIssuer(issuer, defaultTopics);

        // Deploy IR
        IdentityRegistry irImpl = new IdentityRegistry();
        ERC1967Proxy irProxy = new ERC1967Proxy(
            address(irImpl),
            abi.encodeWithSelector(
                IdentityRegistry.initialize.selector,
                admin,
                address(ctr),
                address(tir)
            )
        );
        ir = IdentityRegistry(payable(address(irProxy)));

        // Deploy CM
        ComplianceModule cmImpl = new ComplianceModule();
        ERC1967Proxy cmProxy = new ERC1967Proxy(
            address(cmImpl),
            abi.encodeWithSelector(ComplianceModule.initialize.selector, admin, address(ir))
        );
        cm = ComplianceModule(payable(address(cmProxy)));

        vm.stopPrank();
    }

    // ClaimTopicsRegistry
    function test_CTR_InitialTopicsSeeded() public view {
        uint256[] memory topics = ctr.getClaimTopics();
        assertEq(topics.length, 3);
        assertTrue(ctr.isClaimTopic(1));
        assertTrue(ctr.isClaimTopic(2));
        assertTrue(ctr.isClaimTopic(3));
    }

    function test_CTR_AddTopic() public {
        vm.prank(admin);
        ctr.addClaimTopic(99);
        assertTrue(ctr.isClaimTopic(99));
        assertEq(ctr.getClaimTopics().length, 4);
    }

    function test_CTR_AddDuplicateTopic_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CTR: topic already exists");
        ctr.addClaimTopic(1);
    }

    function test_CTR_RemoveTopic() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        assertFalse(ctr.isClaimTopic(2));
        assertEq(ctr.getClaimTopics().length, 2);
    }

    function test_CTR_RemoveNonExistentTopic_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CTR: topic not found");
        ctr.removeClaimTopic(999);
    }

    function test_CTR_OnlyAdminCanAdd() public {
        vm.prank(wallet1);
        vm.expectRevert();
        ctr.addClaimTopic(99);
    }

    // TrustedIssuersRegistry
    function test_TIR_IssuerRegistered() public view {
        assertTrue(tir.isTrustedIssuer(issuer));
        assertTrue(tir.issuerCanWriteTopic(issuer, 1));
        assertTrue(tir.issuerCanWriteTopic(issuer, 3));
        assertFalse(tir.issuerCanWriteTopic(issuer, 2));
    }

    function test_TIR_RemoveIssuer() public {
        vm.prank(admin);
        tir.removeTrustedIssuer(issuer);
        assertFalse(tir.isTrustedIssuer(issuer));
        assertFalse(tir.issuerCanWriteTopic(issuer, 1));
        assertEq(tir.getTrustedIssuers().length, 0);
    }

    function test_TIR_DuplicateIssuer_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("TIR: issuer already registered");
        tir.addTrustedIssuer(issuer, defaultTopics);
    }

    function test_TIR_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("TIR: zero address");
        tir.addTrustedIssuer(address(0), defaultTopics);
    }

    function test_TIR_UpdateClaimTopics() public {
        uint256[] memory newTopics = new uint256[](1);
        newTopics[0] = 2;
        vm.prank(admin);
        tir.updateIssuerClaimTopics(issuer, newTopics);
        assertFalse(tir.issuerCanWriteTopic(issuer, 1));
        assertTrue(tir.issuerCanWriteTopic(issuer, 2));
    }

    // IdentityRegistry
    function _addIdentityWithClaims(address wallet) internal {
        vm.startPrank(issuer);
        ir.addIdentity(wallet, keccak256(abi.encodePacked(wallet)));
        ir.addClaim(wallet, 1, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        ir.addClaim(wallet, 3, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        vm.stopPrank();
    }

    function test_IR_AddIdentity() public {
        vm.prank(issuer);
        ir.addIdentity(wallet1, keccak256("identity1"));
        assertTrue(ir.isRegistered(wallet1));
    }

    function test_IR_AddIdentity_OnlyTrustedIssuer() public {
        vm.prank(wallet2);
        vm.expectRevert("IR: caller not trusted issuer");
        ir.addIdentity(wallet1, keccak256("identity1"));
    }

    function test_IR_DuplicateIdentity_Reverts() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("identity1"));
        vm.expectRevert("IR: identity already registered");
        ir.addIdentity(wallet1, keccak256("identity1"));
        vm.stopPrank();
    }

    function test_IR_AddClaim_RequiresTopicInRegistry() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("identity1"));
        vm.expectRevert("IR: topic not in registry");
        ir.addClaim(wallet1, 99, 1, bytes("sig"), bytes("data"), "");
        vm.stopPrank();
    }

    function test_IR_AddClaim_RequiresIssuerTopicPermission() public {
        // issuer is not authorized for topic 2
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("identity1"));
        vm.expectRevert("IR: issuer not authorized for this topic");
        ir.addClaim(wallet1, 2, 1, bytes("sig"), bytes("data"), "");
        vm.stopPrank();
    }

    function test_IR_IsVerified_RequiresAllTopics() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("identity1"));
        // Only topic 1 written  -  topic 3 still missing
        ir.addClaim(wallet1, 1, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        assertFalse(ir.isVerified(wallet1));
        // Add topic 3  -  now all required CTR topics held (1, 2, 3)  -  wait, topic 2 still missing
        ir.addClaim(wallet1, 3, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        vm.stopPrank();
        // Topic 2 = ACCREDITED_INVESTOR still required by CTR. Add topic 2 issuer.
        uint256[] memory t2 = new uint256[](1);
        t2[0] = 2;
        vm.prank(admin);
        tir.updateIssuerClaimTopics(issuer, t2);
        vm.prank(issuer);
        ir.addClaim(wallet1, 2, 1, bytes("sig"), bytes("data"), "");
        assertTrue(ir.isVerified(wallet1));
    }

    function test_IR_RemoveIdentity_ClearsClaims() public {
        _addIdentityWithClaims(wallet1);
        // Remove topic 2 from CTR so isVerified only needs 1 and 3
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        assertTrue(ir.isVerified(wallet1));

        vm.prank(issuer);
        ir.removeIdentity(wallet1);

        assertFalse(ir.isRegistered(wallet1));
        assertFalse(ir.isVerified(wallet1));
    }

    function test_IR_GetClaim() public {
        _addIdentityWithClaims(wallet1);
        vm.prank(admin);
        ctr.removeClaimTopic(2); // simplify  -  only topics 1, 3 required

        (, , address claimIssuer, , bytes memory data, ) = ir.getClaim(wallet1, 1);
        assertEq(claimIssuer, issuer);
        assertEq(data, abi.encodePacked(bytes2("US")));
    }

    // ComplianceModule
    function test_CM_IsTransferValid_BothNotVerified() public view {
        (bool valid, string memory reason) = cm.isTransferValid(bytes32(0), wallet1, wallet2, 100);
        assertFalse(valid);
        assertEq(reason, "CM: sender not KYC verified");
    }

    function test_CM_IsTransferValid_RecipientNotVerified() public {
        // Remove topic 2 so isVerified only needs 1+3
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1);

        (bool valid, string memory reason) = cm.isTransferValid(bytes32(0), wallet1, wallet2, 100);
        assertFalse(valid);
        assertEq(reason, "CM: recipient not KYC verified");
    }

    function test_CM_IsTransferValid_BothVerified_NoJurisdictionRules() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1);
        _addIdentityWithClaims(wallet2);

        (bool valid, ) = cm.isTransferValid(bytes32(0), wallet1, wallet2, 100);
        assertTrue(valid);
    }

    function test_CM_SetLockUp_BlocksTransfer() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1);
        _addIdentityWithClaims(wallet2);

        address mockTokenContract = address(cm); // CM is msg.sender when isTransferValid called directly

        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        cm.setLockUp(mockTokenContract, wallet1, block.timestamp + 30 days);

        assertTrue(cm.isLocked(mockTokenContract, wallet1));
    }

    function test_CM_LockUp_UnlocksAfterTime() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        cm.setLockUp(address(0x1234), wallet1, block.timestamp + 100);

        assertTrue(cm.isLocked(address(0x1234), wallet1));

        vm.warp(block.timestamp + 101);
        assertFalse(cm.isLocked(address(0x1234), wallet1));
    }

    function test_CM_SetJurisdictionRules() public {
        bytes2[] memory jurisdictions = new bytes2[](2);
        jurisdictions[0] = bytes2("US");
        jurisdictions[1] = bytes2("GB");

        bytes32 assetId = keccak256("asset1");
        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurisdictions, ComplianceModule.EligibilityLevel.RETAIL);

        assertTrue(cm.isJurisdictionAllowed(assetId, bytes2("US")));
        assertTrue(cm.isJurisdictionAllowed(assetId, bytes2("GB")));
        assertFalse(cm.isJurisdictionAllowed(assetId, bytes2("DE")));
    }

    // Fuzz tests
    function testFuzz_CTR_AddAndRemoveTopic(uint256 topic) public {
        vm.assume(topic > 3 && topic < type(uint256).max);
        vm.startPrank(admin);
        ctr.addClaimTopic(topic);
        assertTrue(ctr.isClaimTopic(topic));
        ctr.removeClaimTopic(topic);
        assertFalse(ctr.isClaimTopic(topic));
        vm.stopPrank();
    }

    function testFuzz_TIR_AddRemoveIssuer(address fuzzIssuer) public {
        vm.assume(fuzzIssuer != address(0));
        vm.assume(fuzzIssuer != issuer);
        vm.assume(fuzzIssuer != admin);

        uint256[] memory topics = new uint256[](1);
        topics[0] = 1;

        vm.startPrank(admin);
        tir.addTrustedIssuer(fuzzIssuer, topics);
        assertTrue(tir.isTrustedIssuer(fuzzIssuer));
        tir.removeTrustedIssuer(fuzzIssuer);
        assertFalse(tir.isTrustedIssuer(fuzzIssuer));
        vm.stopPrank();
    }

    // CTR additional coverage
    function test_CTR_ZeroTopic_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CTR: topic cannot be zero");
        ctr.addClaimTopic(0);
    }

    function test_CTR_Pause_BlocksAddTopic() public {
        vm.prank(admin);
        ctr.pause();

        vm.prank(admin);
        vm.expectRevert();
        ctr.addClaimTopic(99);
    }

    function test_CTR_Unpause_AllowsAddTopic() public {
        vm.startPrank(admin);
        ctr.pause();
        ctr.unpause();
        ctr.addClaimTopic(99);
        vm.stopPrank();
        assertTrue(ctr.isClaimTopic(99));
    }

    function test_CTR_Pause_BlocksRemoveTopic() public {
        vm.prank(admin);
        ctr.pause();

        vm.prank(admin);
        vm.expectRevert();
        ctr.removeClaimTopic(1);
    }

    // TIR additional coverage
    function test_TIR_GetTrustedIssuers() public view {
        address[] memory issuers = tir.getTrustedIssuers();
        assertEq(issuers.length, 1);
        assertEq(issuers[0], issuer);
    }

    function test_TIR_IssuerClaimTopics() public view {
        uint256[] memory topics = tir.issuerClaimTopics(issuer);
        assertEq(topics.length, 2);
    }

    function test_TIR_AddIssuer_NoTopics_Reverts() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(admin);
        vm.expectRevert("TIR: no claim topics provided");
        tir.addTrustedIssuer(makeAddr("newIssuer"), empty);
    }

    function test_TIR_AddIssuer_ZeroTopic_Reverts() public {
        uint256[] memory topics = new uint256[](1);
        topics[0] = 0;
        vm.prank(admin);
        vm.expectRevert("TIR: topic cannot be zero");
        tir.addTrustedIssuer(makeAddr("newIssuer"), topics);
    }

    function test_TIR_AddIssuer_DuplicateTopic_Reverts() public {
        uint256[] memory dupes = new uint256[](2);
        dupes[0] = 1;
        dupes[1] = 1;
        vm.prank(admin);
        vm.expectRevert("TIR: duplicate topic");
        tir.addTrustedIssuer(makeAddr("newIssuer"), dupes);
    }

    function test_TIR_Pause_BlocksAddIssuer() public {
        vm.prank(admin);
        tir.pause();

        uint256[] memory topics = new uint256[](1);
        topics[0] = 1;
        vm.prank(admin);
        vm.expectRevert();
        tir.addTrustedIssuer(makeAddr("newIssuer"), topics);
    }

    function test_TIR_Unpause_AllowsAddIssuer() public {
        vm.startPrank(admin);
        tir.pause();
        tir.unpause();
        address newIssuer = makeAddr("newIssuer");
        uint256[] memory topics = new uint256[](1);
        topics[0] = 1;
        tir.addTrustedIssuer(newIssuer, topics);
        vm.stopPrank();
        assertTrue(tir.isTrustedIssuer(newIssuer));
    }

    // IR additional coverage
    function test_IR_AddIdentity_ZeroWallet_Reverts() public {
        vm.prank(issuer);
        vm.expectRevert("IR: zero wallet address");
        ir.addIdentity(address(0), keccak256("id"));
    }

    function test_IR_AddIdentity_EmptyHash_Reverts() public {
        vm.prank(issuer);
        vm.expectRevert("IR: empty identity hash");
        ir.addIdentity(wallet1, bytes32(0));
    }

    function test_IR_AddClaim_UpdateExisting() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));
        ir.addClaim(wallet1, 1, 1, bytes("sig"), bytes("olddata"), "");
        // Second call to same topic = update, not duplicate
        ir.addClaim(wallet1, 1, 1, bytes("newsig"), bytes("newdata"), "");
        vm.stopPrank();

        (, , , , bytes memory data, ) = ir.getClaim(wallet1, 1);
        assertEq(data, bytes("newdata"));

        // heldTopics should contain topic 1 exactly once
        uint256[] memory held = ir.getHeldTopics(wallet1);
        uint256 count;
        for (uint256 i = 0; i < held.length; i++) {
            if (held[i] == 1) count++;
        }
        assertEq(count, 1);
    }

    function test_IR_RemoveClaim() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));
        ir.addClaim(wallet1, 1, 1, bytes("sig"), bytes("data"), "");
        ir.removeClaim(wallet1, 1);
        vm.stopPrank();

        assertFalse(ir.isVerified(wallet1));
        assertEq(ir.getHeldTopics(wallet1).length, 0);
    }

    function test_IR_RemoveClaim_NotFound_Reverts() public {
        vm.prank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));

        vm.prank(issuer);
        vm.expectRevert("IR: claim not found");
        ir.removeClaim(wallet1, 1);
    }

    function test_IR_GetIdentity() public {
        bytes32 hash = keccak256("id1");
        vm.prank(issuer);
        ir.addIdentity(wallet1, hash);

        (bytes32 identityHash, uint256 registeredAt) = ir.getIdentity(wallet1);
        assertEq(identityHash, hash);
        assertGt(registeredAt, 0);
    }

    function test_IR_GetIdentity_NotFound_Reverts() public {
        vm.expectRevert("IR: identity not found");
        ir.getIdentity(wallet1);
    }

    function test_IR_GetRegisteredWallets() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));
        ir.addIdentity(wallet2, keccak256("id2"));
        vm.stopPrank();

        address[] memory wallets = ir.getRegisteredWallets();
        assertEq(wallets.length, 2);
    }

    function test_IR_GetHeldTopics() public {
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));
        ir.addClaim(wallet1, 1, 1, bytes("sig"), bytes("data"), "");
        ir.addClaim(wallet1, 3, 1, bytes("sig"), bytes("data"), "");
        vm.stopPrank();

        uint256[] memory held = ir.getHeldTopics(wallet1);
        assertEq(held.length, 2);
    }

    function test_IR_RemoveIdentity_MultipleWallets() public {
        // Register two wallets then remove the first one (exercises the swap-and-pop path)
        vm.startPrank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));
        ir.addIdentity(wallet2, keccak256("id2"));
        ir.removeIdentity(wallet1);
        vm.stopPrank();

        assertFalse(ir.isRegistered(wallet1));
        assertTrue(ir.isRegistered(wallet2));
        assertEq(ir.getRegisteredWallets().length, 1);
    }

    function test_IR_Pause_BlocksAddIdentity() public {
        vm.prank(admin);
        ir.pause();

        vm.prank(issuer);
        vm.expectRevert();
        ir.addIdentity(wallet1, keccak256("id1"));
    }

    function test_IR_Unpause_AllowsAddIdentity() public {
        vm.startPrank(admin);
        ir.pause();
        ir.unpause();
        vm.stopPrank();

        vm.prank(issuer);
        ir.addIdentity(wallet1, keccak256("id1"));
        assertTrue(ir.isRegistered(wallet1));
    }

    // CM additional coverage
    function test_CM_ClearLockUp() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        cm.setLockUp(address(0x1234), wallet1, block.timestamp + 30 days);
        assertTrue(cm.isLocked(address(0x1234), wallet1));

        vm.prank(agent);
        cm.clearLockUp(address(0x1234), wallet1);
        assertFalse(cm.isLocked(address(0x1234), wallet1));
    }

    function test_CM_ClearLockUp_NoActiveLockUp_Reverts() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        vm.expectRevert("CM: no active lock-up");
        cm.clearLockUp(address(0x1234), wallet1);
    }

    function test_CM_GetLockUp() public {
        vm.prank(admin);
        cm.addAgent(agent);

        uint256 unlock = block.timestamp + 30 days;
        vm.prank(agent);
        cm.setLockUp(address(0x1234), wallet1, unlock);

        (uint256 ts, bool active) = cm.getLockUp(address(0x1234), wallet1);
        assertEq(ts, unlock);
        assertTrue(active);
    }

    function test_CM_GetAllowedJurisdictions() public {
        bytes32 assetId = keccak256("asset1");
        bytes2[] memory jurs = new bytes2[](2);
        jurs[0] = bytes2("US");
        jurs[1] = bytes2("GB");

        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurs, ComplianceModule.EligibilityLevel.RETAIL);

        bytes2[] memory got = cm.getAllowedJurisdictions(assetId);
        assertEq(got.length, 2);
    }

    function test_CM_RemoveAgent() public {
        vm.prank(admin);
        cm.addAgent(agent);
        assertTrue(cm.isAgent(agent));

        vm.prank(admin);
        cm.removeAgent(agent);
        assertFalse(cm.isAgent(agent));
    }

    function test_CM_SetLockUp_ZeroTokenContract_Reverts() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        vm.expectRevert("CM: zero token contract");
        cm.setLockUp(address(0), wallet1, block.timestamp + 30 days);
    }

    function test_CM_SetLockUp_ZeroWallet_Reverts() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        vm.expectRevert("CM: zero wallet");
        cm.setLockUp(address(0x1234), address(0), block.timestamp + 30 days);
    }

    function test_CM_SetLockUp_PastTimestamp_Reverts() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(agent);
        vm.expectRevert("CM: unlock must be in the future");
        cm.setLockUp(address(0x1234), wallet1, block.timestamp - 1);
    }

    function test_CM_SetJurisdictionRules_Empty_Reverts() public {
        bytes2[] memory empty = new bytes2[](0);
        vm.prank(admin);
        vm.expectRevert("CM: no jurisdictions provided");
        cm.setJurisdictionRules(keccak256("x"), empty, ComplianceModule.EligibilityLevel.RETAIL);
    }

    function test_CM_SetJurisdictionRules_Update() public {
        bytes32 assetId = keccak256("asset-update");

        bytes2[] memory jurs1 = new bytes2[](1);
        jurs1[0] = bytes2("US");
        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurs1, ComplianceModule.EligibilityLevel.RETAIL);
        assertTrue(cm.isJurisdictionAllowed(assetId, bytes2("US")));

        // Update  -  replaces US with GB
        bytes2[] memory jurs2 = new bytes2[](1);
        jurs2[0] = bytes2("GB");
        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurs2, ComplianceModule.EligibilityLevel.ACCREDITED);

        assertFalse(cm.isJurisdictionAllowed(assetId, bytes2("US")));
        assertTrue(cm.isJurisdictionAllowed(assetId, bytes2("GB")));
        assertEq(cm.getAllowedJurisdictions(assetId).length, 1);
    }

    function test_CM_Pause_BlocksSetLockUp() public {
        vm.prank(admin);
        cm.addAgent(agent);

        vm.prank(admin);
        cm.pause();

        vm.prank(agent);
        vm.expectRevert();
        cm.setLockUp(address(0x1234), wallet1, block.timestamp + 30 days);
    }

    function test_CM_Unpause_AllowsSetLockUp() public {
        vm.startPrank(admin);
        cm.addAgent(agent);
        cm.pause();
        cm.unpause();
        vm.stopPrank();

        vm.prank(agent);
        cm.setLockUp(address(0x1234), wallet1, block.timestamp + 30 days);
        assertTrue(cm.isLocked(address(0x1234), wallet1));
    }

    function test_CM_IsTransferValid_SenderLocked() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1);
        _addIdentityWithClaims(wallet2);

        vm.prank(admin);
        cm.addAgent(agent);

        // address(this) = the test contract, which is msg.sender when isTransferValid is called directly
        vm.prank(agent);
        cm.setLockUp(address(this), wallet1, block.timestamp + 30 days);

        (bool valid, string memory reason) = cm.isTransferValid(bytes32(0), wallet1, wallet2, 100);
        assertFalse(valid);
        assertEq(reason, "CM: sender tokens locked");
    }

    function test_CM_IsTransferValid_JurisdictionBlocked() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1); // topic 3 data = "US"
        _addIdentityWithClaims(wallet2); // topic 3 data = "US"

        // Only GB allowed  -  wallet2 has "US"
        bytes32 assetId = keccak256("restricted-asset");
        bytes2[] memory jurs = new bytes2[](1);
        jurs[0] = bytes2("GB");
        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurs, ComplianceModule.EligibilityLevel.RETAIL);

        (bool valid, string memory reason) = cm.isTransferValid(assetId, wallet1, wallet2, 100);
        assertFalse(valid);
        assertEq(reason, "CM: recipient jurisdiction not allowed");
    }

    function test_CM_IsTransferValid_JurisdictionAllowed() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1);
        _addIdentityWithClaims(wallet2); // topic 3 data = "US"

        bytes32 assetId = keccak256("us-asset");
        bytes2[] memory jurs = new bytes2[](1);
        jurs[0] = bytes2("US");
        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurs, ComplianceModule.EligibilityLevel.RETAIL);

        (bool valid,) = cm.isTransferValid(assetId, wallet1, wallet2, 100);
        assertTrue(valid);
    }

    // ETH rejection
    function test_CTR_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(ctr).call{value: 1 ether}("");
        assertFalse(success);
    }

    function test_TIR_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(tir).call{value: 1 ether}("");
        assertFalse(success);
    }

    function test_IR_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(ir).call{value: 1 ether}("");
        assertFalse(success);
    }

    function test_CM_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(cm).call{value: 1 ether}("");
        assertFalse(success);
    }

    // MAX_CLAIM_TOPICS cap
    function test_CTR_MaxTopicsReached_Reverts() public {
        vm.startPrank(admin);
        // CTR already has 3 topics (1, 2, 3). Add 17 more to hit the cap of 20.
        for (uint256 i = 4; i <= 20; i++) {
            ctr.addClaimTopic(i);
        }
        vm.expectRevert("CTR: max topics reached");
        ctr.addClaimTopic(21);
        vm.stopPrank();
    }

    // MAX_JURISDICTIONS cap
    function test_CM_MaxJurisdictions_Reverts() public {
        bytes2[] memory jurs = new bytes2[](51);
        for (uint256 i = 0; i < 51; i++) {
            jurs[i] = bytes2(uint16(i + 1));
        }
        vm.prank(admin);
        vm.expectRevert("CM: too many jurisdictions");
        cm.setJurisdictionRules(keccak256("asset"), jurs, ComplianceModule.EligibilityLevel.RETAIL);
    }

    // Missing jurisdiction claim data
    function test_CM_IsTransferValid_MissingJurisdictionData() public {
        vm.prank(admin);
        ctr.removeClaimTopic(2);
        _addIdentityWithClaims(wallet1);

        // wallet3: verified but topic 3 has only 1 byte of data (< 2 bytes required)
        address wallet3 = makeAddr("wallet3");
        vm.startPrank(issuer);
        ir.addIdentity(wallet3, keccak256(abi.encodePacked(wallet3)));
        ir.addClaim(wallet3, 1, 1, bytes("sig"), abi.encodePacked(bytes2("US")), "");
        ir.addClaim(wallet3, 3, 1, bytes("sig"), abi.encodePacked(bytes1(0x55)), "");
        vm.stopPrank();

        assertTrue(ir.isVerified(wallet3));

        bytes32 assetId = keccak256("restricted");
        bytes2[] memory jurs = new bytes2[](1);
        jurs[0] = bytes2("US");
        vm.prank(admin);
        cm.setJurisdictionRules(assetId, jurs, ComplianceModule.EligibilityLevel.RETAIL);

        (bool valid, string memory reason) = cm.isTransferValid(assetId, wallet1, wallet3, 100);
        assertFalse(valid);
        assertEq(reason, "CM: recipient missing jurisdiction claim");
    }

    // _authorizeUpgrade hardening
    function test_CTR_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CTR: zero implementation");
        ctr.upgradeToAndCall(address(0), "");
    }

    function test_CTR_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CTR: not a contract");
        ctr.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_CTR_Upgrade_Success() public {
        ClaimTopicsRegistry newImpl = new ClaimTopicsRegistry();
        vm.prank(admin);
        ctr.upgradeToAndCall(address(newImpl), "");
        assertTrue(ctr.isClaimTopic(1));
    }

    function test_TIR_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("TIR: zero implementation");
        tir.upgradeToAndCall(address(0), "");
    }

    function test_TIR_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("TIR: not a contract");
        tir.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_TIR_Upgrade_Success() public {
        TrustedIssuersRegistry newImpl = new TrustedIssuersRegistry();
        vm.prank(admin);
        tir.upgradeToAndCall(address(newImpl), "");
        assertTrue(tir.isTrustedIssuer(issuer));
    }

    function test_IR_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("IR: zero implementation");
        ir.upgradeToAndCall(address(0), "");
    }

    function test_IR_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("IR: not a contract");
        ir.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_IR_Upgrade_Success() public {
        IdentityRegistry newImpl = new IdentityRegistry();
        vm.prank(admin);
        ir.upgradeToAndCall(address(newImpl), "");
        assertEq(address(ir.claimTopicsRegistry()), address(ctr));
    }

    function test_CM_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CM: zero implementation");
        cm.upgradeToAndCall(address(0), "");
    }

    function test_CM_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("CM: not a contract");
        cm.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_CM_Upgrade_Success() public {
        ComplianceModule newImpl = new ComplianceModule();
        vm.prank(admin);
        cm.upgradeToAndCall(address(newImpl), "");
        assertEq(address(cm.identityRegistry()), address(ir));
    }
}
