// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";

/**
 * @title ComplianceModule
 * @notice Enforces jurisdiction rules, lock-up periods, and KYC eligibility on every
 *         ERC-3643 token transfer. Rules are set per asset so each tokenized asset can
 *         have its own jurisdiction whitelist, lock-up schedule, and eligibility tier.
 * @dev UUPS upgradeable. Ownable2Step prevents accidental ownership transfer.
 */
contract ComplianceModule is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    uint256 private constant MAX_JURISDICTIONS = 50;

    enum EligibilityLevel { RETAIL, ACCREDITED, PROFESSIONAL }

    struct AssetRules {
        bytes2[] allowedJurisdictions;
        mapping(bytes2 => bool) jurisdictionAllowed;
        EligibilityLevel minEligibility;
        bool rulesSet;
    }

    struct LockUp {
        uint256 unlockTimestamp;
        bool    active;
    }

    IdentityRegistry public identityRegistry;

    // assetId (keccak256 of platform UUID) => rules
    mapping(bytes32 => AssetRules) private _assetRules;

    // tokenContract => wallet => lock-up
    mapping(address => mapping(address => LockUp)) private _lockUps;

    // Authorized agents (backend signer wallets that can set lock-ups and eligibility)
    mapping(address => bool) private _agents;

    // wallet => investor eligibility level (set by Sumsub backend agent at KYC time)
    mapping(address => EligibilityLevel) private _walletEligibility;

    // Events
    event JurisdictionRulesSet(bytes32 indexed assetId, bytes2[] jurisdictions, EligibilityLevel minLevel);
    event WalletEligibilitySet(address indexed wallet, EligibilityLevel level);
    event LockUpSet(address indexed tokenContract, address indexed wallet, uint256 unlockTimestamp);
    event LockUpCleared(address indexed tokenContract, address indexed wallet);
    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);
    event TransferBlocked(address indexed from, address indexed to, string reason);
    event ContractUpgraded(address indexed newImplementation);

    modifier onlyAgent() {
        require(_agents[msg.sender] || msg.sender == owner(), "CM: caller not agent");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    address public upgradeAdmin;
    address public pendingUpgradeAdmin;

    event UpgradeAdminTransferred(address indexed previous, address indexed next);
    event UpgradeAdminProposed(address indexed proposed);

    function initialize(address admin, address _identityRegistry, address _upgradeAdmin) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        require(_identityRegistry != address(0), "CM: zero IR address");
        require(_upgradeAdmin     != address(0), "CM: zero upgrade admin");
        identityRegistry = IdentityRegistry(payable(_identityRegistry));
        upgradeAdmin = _upgradeAdmin;
    }

    function proposeUpgradeAdmin(address newAdmin) external {
        require(msg.sender == upgradeAdmin, "CM: caller not upgrade admin");
        require(newAdmin != address(0), "CM: zero address");
        pendingUpgradeAdmin = newAdmin;
        emit UpgradeAdminProposed(newAdmin);
    }

    function acceptUpgradeAdmin() external {
        require(msg.sender == pendingUpgradeAdmin, "CM: caller not pending upgrade admin");
        emit UpgradeAdminTransferred(upgradeAdmin, msg.sender);
        upgradeAdmin = msg.sender;
        pendingUpgradeAdmin = address(0);
    }

    //  Rule configuration (onlyOwner / admin) 

    /**
     * @notice Sets jurisdiction whitelist and minimum eligibility level for an asset.
     *         assetId = keccak256(abi.encodePacked(platformUUID))
     */
    function setJurisdictionRules(
        bytes32 assetId,
        bytes2[] calldata allowedJurisdictions,
        EligibilityLevel minEligibility
    ) external onlyOwner whenNotPaused {
        require(allowedJurisdictions.length > 0, "CM: no jurisdictions provided");
        require(allowedJurisdictions.length <= MAX_JURISDICTIONS, "CM: too many jurisdictions");

        AssetRules storage rules = _assetRules[assetId];

        // Clear previous jurisdiction mappings
        if (rules.rulesSet) {
            bytes2[] memory old = rules.allowedJurisdictions;
            for (uint256 i = 0; i < old.length; i++) {
                rules.jurisdictionAllowed[old[i]] = false;
            }
            delete rules.allowedJurisdictions;
        }

        for (uint256 i = 0; i < allowedJurisdictions.length; i++) {
            rules.allowedJurisdictions.push(allowedJurisdictions[i]);
            rules.jurisdictionAllowed[allowedJurisdictions[i]] = true;
        }
        rules.minEligibility = minEligibility;
        rules.rulesSet = true;

        emit JurisdictionRulesSet(assetId, allowedJurisdictions, minEligibility);
    }

    //  Lock-up management (onlyAgent) 

    /**
     * @notice Sets a lock-up period for an investor on a specific token contract.
     *         Called at token purchase time. Transfer blocked until block.timestamp >= unlockTimestamp.
     */
    function setLockUp(
        address tokenContract,
        address wallet,
        uint256 unlockTimestamp
    ) external onlyAgent whenNotPaused {
        require(tokenContract != address(0), "CM: zero token contract");
        require(wallet != address(0), "CM: zero wallet");
        require(unlockTimestamp > block.timestamp, "CM: unlock must be in the future");

        _lockUps[tokenContract][wallet] = LockUp({ unlockTimestamp: unlockTimestamp, active: true });
        emit LockUpSet(tokenContract, wallet, unlockTimestamp);
    }

    /**
     * @notice Sets the eligibility level for an investor wallet. Called by Sumsub backend agent
     *         after completing KYC — accredited/professional status is determined off-chain.
     */
    function setWalletEligibility(address wallet, EligibilityLevel level) external onlyAgent whenNotPaused {
        require(wallet != address(0), "CM: zero wallet");
        _walletEligibility[wallet] = level;
        emit WalletEligibilitySet(wallet, level);
    }

    function clearLockUp(address tokenContract, address wallet) external onlyAgent whenNotPaused {
        require(_lockUps[tokenContract][wallet].active, "CM: no active lock-up");
        delete _lockUps[tokenContract][wallet];
        emit LockUpCleared(tokenContract, wallet);
    }

    // Agent management
    function addAgent(address agent) external onlyOwner {
        require(agent != address(0), "CM: zero address");
        _agents[agent] = true;
        emit AgentAdded(agent);
    }

    function removeAgent(address agent) external onlyOwner {
        _agents[agent] = false;
        emit AgentRemoved(agent);
    }

    // The compliance gate
    /**
     * @notice Primary transfer gate called by FractionalToken on every transfer.
     *         Returns (false, reason) if any check fails; the token contract reverts on false.
     * @param assetId  keccak256 of the platform asset UUID
     * @param from     Sender wallet
     * @param to       Recipient wallet
     * @param amount   Reserved for future per-amount caps; unused in current rules
     */
    function isTransferValid(
        bytes32 assetId,
        address tokenContract,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool valid, string memory reason) {
        amount; // silence unused warning  -  reserved for Phase 2 per-amount caps

        // Both wallets must be KYC-verified in the IdentityRegistry
        if (!identityRegistry.isVerified(from)) {
            return (false, "CM: sender not KYC verified");
        }
        if (!identityRegistry.isVerified(to)) {
            return (false, "CM: recipient not KYC verified");
        }

        // Sender must not be under a lock-up on this token contract
        LockUp storage fromLock = _lockUps[tokenContract][from];
        if (fromLock.active && block.timestamp < fromLock.unlockTimestamp) {
            return (false, "CM: sender tokens locked");
        }

        // If asset has jurisdiction rules set, validate recipient jurisdiction + eligibility
        AssetRules storage rules = _assetRules[assetId];
        if (rules.rulesSet) {
            // Eligibility level check (RETAIL=0, ACCREDITED=1, PROFESSIONAL=2)
            if (rules.minEligibility != EligibilityLevel.RETAIL) {
                if (uint8(_walletEligibility[to]) < uint8(rules.minEligibility)) {
                    return (false, "CM: recipient eligibility too low");
                }
            }

            if (rules.allowedJurisdictions.length > 0) {
                bytes memory claimData;
                try identityRegistry.getClaim(to, 3) returns (uint256, address, bytes memory data, string memory) {
                    claimData = data;
                } catch {
                    return (false, "CM: recipient missing jurisdiction claim");
                }
                if (claimData.length < 2) {
                    return (false, "CM: recipient missing jurisdiction claim");
                }
                bytes2 jurisdiction = bytes2(claimData);
                if (!rules.jurisdictionAllowed[jurisdiction]) {
                    return (false, "CM: recipient jurisdiction not allowed");
                }
            }
        }

        return (true, "");
    }

    // View helpers
    function getLockUp(address tokenContract, address wallet)
        external
        view
        returns (uint256 unlockTimestamp, bool active)
    {
        LockUp storage l = _lockUps[tokenContract][wallet];
        return (l.unlockTimestamp, l.active);
    }

    function isLocked(address tokenContract, address wallet) external view returns (bool) {
        LockUp storage l = _lockUps[tokenContract][wallet];
        return l.active && block.timestamp < l.unlockTimestamp;
    }

    function isAgent(address account) external view returns (bool) {
        return _agents[account];
    }

    function getWalletEligibility(address wallet) external view returns (EligibilityLevel) {
        return _walletEligibility[wallet];
    }

    function getAllowedJurisdictions(bytes32 assetId) external view returns (bytes2[] memory) {
        return _assetRules[assetId].allowedJurisdictions;
    }

    function isJurisdictionAllowed(bytes32 assetId, bytes2 jurisdiction) external view returns (bool) {
        return _assetRules[assetId].jurisdictionAllowed[jurisdiction];
    }

    // Pause / upgrade
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == upgradeAdmin, "CM: caller not upgrade admin");
        require(newImplementation != address(0), "CM: zero implementation");
        require(newImplementation.code.length > 0, "CM: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("CM: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[47] private __gap;
}
