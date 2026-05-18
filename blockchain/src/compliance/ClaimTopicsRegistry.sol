// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title ClaimTopicsRegistry
 * @notice Defines the required compliance claim topics for the platform.
 *         Topic 1 = KYC_VERIFIED, Topic 2 = ACCREDITED_INVESTOR, Topic 3 = JURISDICTION_ELIGIBLE
 * @dev UUPS upgradeable. Pausing is reserved for Gnosis Safe multisig via onlyOwner.
 *      Ownable2Step prevents accidental ownership transfer to a wrong address.
 */
contract ClaimTopicsRegistry is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    uint256 private constant MAX_CLAIM_TOPICS = 20;

    uint256[] private _claimTopics;
    mapping(uint256 => bool) private _topicExists;

    event ClaimTopicAdded(uint256 indexed claimTopic);
    event ClaimTopicRemoved(uint256 indexed claimTopic);
    event ContractUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        _addTopic(1); // KYC_VERIFIED
        _addTopic(2); // ACCREDITED_INVESTOR
        _addTopic(3); // JURISDICTION_ELIGIBLE
    }

    // Admin functions
    function addClaimTopic(uint256 claimTopic) external onlyOwner whenNotPaused {
        require(claimTopic != 0, "CTR: topic cannot be zero");
        require(!_topicExists[claimTopic], "CTR: topic already exists");
        require(_claimTopics.length < MAX_CLAIM_TOPICS, "CTR: max topics reached");
        _addTopic(claimTopic);
    }

    function removeClaimTopic(uint256 claimTopic) external onlyOwner whenNotPaused {
        require(_topicExists[claimTopic], "CTR: topic not found");
        _topicExists[claimTopic] = false;
        uint256 len = _claimTopics.length;
        for (uint256 i = 0; i < len; i++) {
            if (_claimTopics[i] == claimTopic) {
                _claimTopics[i] = _claimTopics[len - 1];
                _claimTopics.pop();
                break;
            }
        }
        emit ClaimTopicRemoved(claimTopic);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // View functions
    function getClaimTopics() external view returns (uint256[] memory) {
        return _claimTopics;
    }

    function isClaimTopic(uint256 claimTopic) external view returns (bool) {
        return _topicExists[claimTopic];
    }

    // Internal
    function _addTopic(uint256 claimTopic) internal {
        _claimTopics.push(claimTopic);
        _topicExists[claimTopic] = true;
        emit ClaimTopicAdded(claimTopic);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "CTR: zero implementation");
        require(newImplementation.code.length > 0, "CTR: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("CTR: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[50] private __gap;
}
