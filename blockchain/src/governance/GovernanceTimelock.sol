// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {TimelockControllerUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";

/**
 * @title GovernanceTimelock
 * @notice Upgrade guard for the LinkBlock platform. All UUPS upgrades to production
 *         contracts must be scheduled through this timelock and wait MIN_DELAY before
 *         execution. This prevents instant rug-upgrades even if an admin key is compromised.
 *
 * Roles (set at initialization, managed via AccessControl):
 *   PROPOSER_ROLE  — address(es) allowed to schedule upgrade transactions (typically the Gnosis Safe).
 *   EXECUTOR_ROLE  — address(es) allowed to execute after the delay (also the Safe, or address(0) for open).
 *   CANCELLER_ROLE — defaults to proposer; can abort a queued upgrade.
 *   DEFAULT_ADMIN  — set to address(0) after init so no one can grant new roles unilaterally.
 *
 * @dev UUPS upgradeable. The timelock itself is upgradeable so it can be replaced via
 *      a governance vote, but its own upgrade must also pass through the delay.
 */
contract GovernanceTimelock is
    Initializable,
    TimelockControllerUpgradeable,
    UUPSUpgradeable
{
    /// @notice 48-hour minimum delay between scheduling and executing an upgrade.
    uint256 public constant MIN_DELAY = 48 hours;

    event TimelockUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the timelock.
     * @param minDelay    Must be >= MIN_DELAY (48 h). Pass MIN_DELAY to use the default.
     * @param proposers   Addresses allowed to schedule transactions (e.g. Gnosis Safe).
     * @param executors   Addresses allowed to execute after delay. Pass address(0) for open execution.
     */
    function initialize(
        uint256 minDelay,
        address[] calldata proposers,
        address[] calldata executors
    ) external initializer {
        require(minDelay >= MIN_DELAY, "GT: delay below minimum");
        require(proposers.length > 0,  "GT: no proposers");

        // Pass address(0) as admin to lock down role management after init.
        // Roles can only be managed via queued transactions through the timelock itself.
        __TimelockController_init(minDelay, proposers, executors, address(0));
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Upgrades this timelock contract. The call itself must come through the
     *         timelock's own queue (proposer schedules, delay passes, executor calls).
     */
    function _authorizeUpgrade(address newImplementation) internal override {
        require(
            msg.sender == address(this),
            "GT: upgrade must go through timelock"
        );
        require(newImplementation != address(0), "GT: zero implementation");
        require(newImplementation.code.length > 0, "GT: not a contract");
        emit TimelockUpgraded(newImplementation);
    }

    uint256[50] private __gap;
}
