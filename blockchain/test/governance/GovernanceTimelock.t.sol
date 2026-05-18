// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {GovernanceTimelock} from "../../src/governance/GovernanceTimelock.sol";
import {ClaimTopicsRegistry} from "../../src/compliance/ClaimTopicsRegistry.sol";

contract GovernancTimelockTest is Test {
    GovernanceTimelock internal tl;

    address internal proposer  = makeAddr("proposer");
    address internal executor  = makeAddr("executor");
    address internal stranger  = makeAddr("stranger");

    uint256 internal constant DELAY = 48 hours;

    function setUp() public {
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = proposer;
        executors[0] = executor;

        tl = GovernanceTimelock(payable(address(new ERC1967Proxy(
            address(new GovernanceTimelock()),
            abi.encodeWithSelector(
                GovernanceTimelock.initialize.selector,
                DELAY,
                proposers,
                executors
            )
        ))));
    }

    // ── initialize ───────────────────────────────────────────────────────────

    function test_GT_Initialize_MinDelay() public view {
        assertEq(tl.getMinDelay(), DELAY);
    }

    function test_GT_Initialize_ProposerHasRole() public view {
        assertTrue(tl.hasRole(tl.PROPOSER_ROLE(),   proposer));
        assertTrue(tl.hasRole(tl.CANCELLER_ROLE(), proposer));
    }

    function test_GT_Initialize_ExecutorHasRole() public view {
        assertTrue(tl.hasRole(tl.EXECUTOR_ROLE(), executor));
    }

    function test_GT_Initialize_NoAdminKey() public view {
        // DEFAULT_ADMIN_ROLE should belong to address(this) == the timelock contract itself,
        // not to any EOA, so no external party can unilaterally grant new roles.
        assertFalse(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), proposer));
        assertFalse(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), executor));
    }

    function test_GT_Initialize_DelayBelowMin_Reverts() public {
        address[] memory p = new address[](1);
        address[] memory e = new address[](1);
        p[0] = proposer; e[0] = executor;

        GovernanceTimelock impl = new GovernanceTimelock();
        vm.expectRevert("GT: delay below minimum");
        new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(
                GovernanceTimelock.initialize.selector,
                DELAY - 1,
                p,
                e
            )
        );
    }

    function test_GT_Initialize_NoProposers_Reverts() public {
        address[] memory p = new address[](0);
        address[] memory e = new address[](1);
        e[0] = executor;

        GovernanceTimelock impl = new GovernanceTimelock();
        vm.expectRevert("GT: no proposers");
        new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(
                GovernanceTimelock.initialize.selector,
                DELAY,
                p,
                e
            )
        );
    }

    function test_GT_Initialize_HigherDelay_Accepted() public {
        address[] memory p = new address[](1);
        address[] memory e = new address[](1);
        p[0] = proposer; e[0] = executor;

        GovernanceTimelock tl2 = GovernanceTimelock(payable(address(new ERC1967Proxy(
            address(new GovernanceTimelock()),
            abi.encodeWithSelector(
                GovernanceTimelock.initialize.selector,
                7 days,
                p,
                e
            )
        ))));
        assertEq(tl2.getMinDelay(), 7 days);
    }

    // ── MIN_DELAY constant ────────────────────────────────────────────────────

    function test_GT_MinDelayConstant() public view {
        assertEq(tl.MIN_DELAY(), 48 hours);
    }

    // ── schedule → warp → execute flow ───────────────────────────────────────

    function test_GT_ScheduleAndExecute() public {
        // Schedule a no-op call to self (updateDelay)
        bytes memory data = abi.encodeWithSelector(
            tl.updateDelay.selector, DELAY
        );

        vm.prank(proposer);
        tl.schedule(address(tl), 0, data, bytes32(0), bytes32(0), DELAY);

        bytes32 id = tl.hashOperation(address(tl), 0, data, bytes32(0), bytes32(0));
        assertTrue(tl.isOperationPending(id));

        // Cannot execute before delay
        vm.prank(executor);
        vm.expectRevert();
        tl.execute(address(tl), 0, data, bytes32(0), bytes32(0));

        // Warp past delay
        vm.warp(block.timestamp + DELAY + 1);
        assertTrue(tl.isOperationReady(id));

        vm.prank(executor);
        tl.execute(address(tl), 0, data, bytes32(0), bytes32(0));

        assertTrue(tl.isOperationDone(id));
    }

    function test_GT_Cancel_ByProposer() public {
        bytes memory data = abi.encodeWithSelector(tl.updateDelay.selector, DELAY);

        vm.prank(proposer);
        tl.schedule(address(tl), 0, data, bytes32(0), bytes32("salt"), DELAY);

        bytes32 id = tl.hashOperation(address(tl), 0, data, bytes32(0), bytes32("salt"));
        assertTrue(tl.isOperationPending(id));

        vm.prank(proposer);
        tl.cancel(id);

        assertFalse(tl.isOperation(id));
    }

    function test_GT_Schedule_OnlyProposer_Reverts() public {
        bytes memory data = abi.encodeWithSelector(tl.updateDelay.selector, DELAY);

        vm.prank(stranger);
        vm.expectRevert();
        tl.schedule(address(tl), 0, data, bytes32(0), bytes32(0), DELAY);
    }

    function test_GT_Execute_OnlyExecutor_Reverts() public {
        bytes memory data = abi.encodeWithSelector(tl.updateDelay.selector, DELAY);

        vm.prank(proposer);
        tl.schedule(address(tl), 0, data, bytes32(0), bytes32(0), DELAY);

        vm.warp(block.timestamp + DELAY + 1);

        vm.prank(stranger);
        vm.expectRevert();
        tl.execute(address(tl), 0, data, bytes32(0), bytes32(0));
    }

    // ── upgrade guard ────────────────────────────────────────────────────────

    function test_GT_Upgrade_MustGoThroughTimelock() public {
        GovernanceTimelock newImpl = new GovernanceTimelock();

        // Direct call from proposer must revert — not through timelock queue
        vm.prank(proposer);
        vm.expectRevert("GT: upgrade must go through timelock");
        tl.upgradeToAndCall(address(newImpl), "");
    }

    function test_GT_Upgrade_ZeroImpl_Reverts() public {
        // Schedule an upgrade with address(0) — it should revert at execution
        bytes memory data = abi.encodeWithSelector(
            tl.upgradeToAndCall.selector, address(0), bytes("")
        );

        vm.prank(proposer);
        tl.schedule(address(tl), 0, data, bytes32(0), bytes32(0), DELAY);

        vm.warp(block.timestamp + DELAY + 1);

        vm.prank(executor);
        vm.expectRevert();
        tl.execute(address(tl), 0, data, bytes32(0), bytes32(0));
    }

    function test_GT_Upgrade_ViaTimelockQueue_Success() public {
        GovernanceTimelock newImpl = new GovernanceTimelock();

        bytes memory data = abi.encodeWithSelector(
            tl.upgradeToAndCall.selector, address(newImpl), bytes("")
        );

        vm.prank(proposer);
        tl.schedule(address(tl), 0, data, bytes32(0), bytes32(0), DELAY);

        vm.warp(block.timestamp + DELAY + 1);

        vm.prank(executor);
        tl.execute(address(tl), 0, data, bytes32(0), bytes32(0));

        // Still functional after upgrade
        assertEq(tl.getMinDelay(), DELAY);
    }

    // ── ETH receive ──────────────────────────────────────────────────────────

    function test_GT_AcceptsETH() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(tl).call{value: 1 ether}("");
        assertTrue(ok);
    }

    // ── platform-contract upgrade via timelock (integration) ─────────────────

    // Deploys a ClaimTopicsRegistry proxy whose upgradeAdmin = timelock, then
    // exercises the full schedule → warp 48h → execute → upgradeToAndCall flow.
    function test_GT_PlatformUpgrade_ViaTimelock_FullFlow() public {
        // Deploy CTR proxy with upgradeAdmin = timelock
        address ctrAdmin = makeAddr("ctrAdmin");
        ClaimTopicsRegistry ctr = _deployCTR(ctrAdmin, address(tl));

        assertEq(ctr.upgradeAdmin(), address(tl));
        assertEq(ctr.getClaimTopics().length, 3); // seeded with topics 1,2,3

        // New implementation to upgrade to
        ClaimTopicsRegistry impl2 = new ClaimTopicsRegistry();

        bytes memory upgradeCall = abi.encodeWithSelector(
            UUPSUpgradeable.upgradeToAndCall.selector,
            address(impl2),
            bytes("")
        );

        // Schedule through the timelock
        vm.prank(proposer);
        tl.schedule(address(ctr), 0, upgradeCall, bytes32(0), bytes32("upgrade-ctr-v2"), DELAY);

        bytes32 opId = tl.hashOperation(
            address(ctr), 0, upgradeCall, bytes32(0), bytes32("upgrade-ctr-v2")
        );
        assertTrue(tl.isOperationPending(opId));

        // Cannot execute before delay expires
        vm.prank(executor);
        vm.expectRevert();
        tl.execute(address(ctr), 0, upgradeCall, bytes32(0), bytes32("upgrade-ctr-v2"));

        // Warp past the 48-hour delay
        vm.warp(block.timestamp + DELAY + 1);
        assertTrue(tl.isOperationReady(opId));

        // Execute the upgrade
        vm.prank(executor);
        tl.execute(address(ctr), 0, upgradeCall, bytes32(0), bytes32("upgrade-ctr-v2"));

        assertTrue(tl.isOperationDone(opId));

        // Verify: implementation slot now points to impl2
        bytes32 IMPL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        address storedImpl = address(uint160(uint256(vm.load(address(ctr), IMPL_SLOT))));
        assertEq(storedImpl, address(impl2));

        // Verify: proxy state is preserved after upgrade
        assertEq(ctr.getClaimTopics().length, 3);
        assertEq(ctr.upgradeAdmin(), address(tl));
    }

    // Any direct upgradeToAndCall bypassing the timelock queue must revert.
    function test_GT_PlatformUpgrade_DirectCall_Reverts() public {
        address ctrAdmin = makeAddr("ctrAdmin2");
        ClaimTopicsRegistry ctr = _deployCTR(ctrAdmin, address(tl));

        ClaimTopicsRegistry impl2 = new ClaimTopicsRegistry();

        // proposer is not the upgradeAdmin; only address(tl) may call _authorizeUpgrade
        vm.prank(proposer);
        vm.expectRevert("CTR: caller not upgrade admin");
        UUPSUpgradeable(address(ctr)).upgradeToAndCall(address(impl2), "");

        // Even the ctrAdmin (owner) cannot upgrade — upgrade authority is separated
        vm.prank(ctrAdmin);
        vm.expectRevert("CTR: caller not upgrade admin");
        UUPSUpgradeable(address(ctr)).upgradeToAndCall(address(impl2), "");
    }

    // Cancel a queued platform upgrade before it executes.
    function test_GT_PlatformUpgrade_Cancel() public {
        address ctrAdmin = makeAddr("ctrAdmin3");
        ClaimTopicsRegistry ctr = _deployCTR(ctrAdmin, address(tl));

        ClaimTopicsRegistry impl2 = new ClaimTopicsRegistry();
        bytes memory upgradeCall = abi.encodeWithSelector(
            UUPSUpgradeable.upgradeToAndCall.selector,
            address(impl2),
            bytes("")
        );

        vm.prank(proposer);
        tl.schedule(address(ctr), 0, upgradeCall, bytes32(0), bytes32("cancel-test"), DELAY);

        bytes32 opId = tl.hashOperation(
            address(ctr), 0, upgradeCall, bytes32(0), bytes32("cancel-test")
        );
        assertTrue(tl.isOperationPending(opId));

        // Proposer cancels before the window opens
        vm.prank(proposer);
        tl.cancel(opId);

        assertFalse(tl.isOperation(opId));

        // After cancellation, even past the delay nothing can be executed
        vm.warp(block.timestamp + DELAY + 1);
        vm.prank(executor);
        vm.expectRevert();
        tl.execute(address(ctr), 0, upgradeCall, bytes32(0), bytes32("cancel-test"));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    function _deployCTR(address admin, address _upgradeAdmin)
        internal
        returns (ClaimTopicsRegistry)
    {
        return ClaimTopicsRegistry(payable(address(new ERC1967Proxy(
            address(new ClaimTopicsRegistry()),
            abi.encodeWithSelector(
                ClaimTopicsRegistry.initialize.selector,
                admin,
                _upgradeAdmin
            )
        ))));
    }
}
