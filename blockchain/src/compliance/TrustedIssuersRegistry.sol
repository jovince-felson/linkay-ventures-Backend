// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title TrustedIssuersRegistry
 * @notice Tracks approved entities (e.g. Sumsub backend signer) authorized to write
 *         compliance claims on-chain. Each issuer is mapped to the claim topics it may write.
 * @dev UUPS upgradeable. Ownable2Step prevents accidental ownership transfer to a wrong address.
 */
contract TrustedIssuersRegistry is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    struct IssuerRecord {
        bool active;
        uint256[] claimTopics;
        mapping(uint256 => bool) topicAllowed;
    }

    mapping(address => IssuerRecord) private _issuers;
    address[] private _issuerList;

    event TrustedIssuerAdded(address indexed issuer, uint256[] claimTopics);
    event TrustedIssuerRemoved(address indexed issuer);
    event IssuerClaimTopicsUpdated(address indexed issuer, uint256[] claimTopics);
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
    }

    // Admin functions
    function addTrustedIssuer(address issuer, uint256[] calldata claimTopics)
        external
        onlyOwner
        whenNotPaused
    {
        require(issuer != address(0), "TIR: zero address");
        require(!_issuers[issuer].active, "TIR: issuer already registered");
        require(claimTopics.length > 0, "TIR: no claim topics provided");

        _issuers[issuer].active = true;
        _setTopics(issuer, claimTopics);
        _issuerList.push(issuer);

        emit TrustedIssuerAdded(issuer, claimTopics);
    }

    function removeTrustedIssuer(address issuer) external onlyOwner whenNotPaused {
        require(_issuers[issuer].active, "TIR: issuer not found");

        _issuers[issuer].active = false;
        uint256[] memory topics = _issuers[issuer].claimTopics;
        for (uint256 i = 0; i < topics.length; i++) {
            _issuers[issuer].topicAllowed[topics[i]] = false;
        }
        delete _issuers[issuer].claimTopics;

        uint256 len = _issuerList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_issuerList[i] == issuer) {
                _issuerList[i] = _issuerList[len - 1];
                _issuerList.pop();
                break;
            }
        }

        emit TrustedIssuerRemoved(issuer);
    }

    function updateIssuerClaimTopics(address issuer, uint256[] calldata claimTopics)
        external
        onlyOwner
        whenNotPaused
    {
        require(_issuers[issuer].active, "TIR: issuer not found");
        require(claimTopics.length > 0, "TIR: no claim topics provided");

        // Clear old topics
        uint256[] memory old = _issuers[issuer].claimTopics;
        for (uint256 i = 0; i < old.length; i++) {
            _issuers[issuer].topicAllowed[old[i]] = false;
        }
        delete _issuers[issuer].claimTopics;

        _setTopics(issuer, claimTopics);
        emit IssuerClaimTopicsUpdated(issuer, claimTopics);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // View functions
    function isTrustedIssuer(address issuer) external view returns (bool) {
        return _issuers[issuer].active;
    }

    function issuerClaimTopics(address issuer) external view returns (uint256[] memory) {
        return _issuers[issuer].claimTopics;
    }

    function issuerCanWriteTopic(address issuer, uint256 topic) external view returns (bool) {
        return _issuers[issuer].active && _issuers[issuer].topicAllowed[topic];
    }

    function getTrustedIssuers() external view returns (address[] memory) {
        return _issuerList;
    }

    // Internal
    function _setTopics(address issuer, uint256[] calldata topics) internal {
        for (uint256 i = 0; i < topics.length; i++) {
            require(topics[i] != 0, "TIR: topic cannot be zero");
            require(!_issuers[issuer].topicAllowed[topics[i]], "TIR: duplicate topic");
            _issuers[issuer].claimTopics.push(topics[i]);
            _issuers[issuer].topicAllowed[topics[i]] = true;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "TIR: zero implementation");
        require(newImplementation.code.length > 0, "TIR: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("TIR: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[50] private __gap;
}
