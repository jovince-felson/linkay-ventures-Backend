// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ClaimTopicsRegistry} from "./ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "./TrustedIssuersRegistry.sol";

/**
 * @title IdentityRegistry
 * @notice Maps investor wallets to verified identities and compliance claims.
 *         isVerified(wallet) returns true only when the wallet has a registered identity
 *         and holds all claim topics required by ClaimTopicsRegistry.
 *         This is the KYC gate checked on every FractionalToken transfer.
 * @dev UUPS upgradeable. Ownable2Step prevents accidental ownership transfer.
 */
contract IdentityRegistry is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    struct Claim {
        uint256 topic;
        address issuer;
        bytes   data;
        string  uri;
    }

    struct Identity {
        bytes32 identityHash;
        bool    registered;
        uint256 registeredAt;
        // topic => Claim
        mapping(uint256 => Claim) claims;
        // tracks which topics this identity actually holds
        uint256[] heldTopics;
        mapping(uint256 => bool) hasTopic;
    }

    ClaimTopicsRegistry    public claimTopicsRegistry;
    TrustedIssuersRegistry public trustedIssuersRegistry;

    mapping(address => Identity) private _identities;
    address[] private _registeredWallets;

    // Events
    event IdentityAdded(address indexed wallet, bytes32 indexed identityHash, uint256 timestamp);
    event IdentityRemoved(address indexed wallet, uint256 timestamp);
    event ClaimAdded(address indexed wallet, uint256 indexed topic, address indexed issuer);
    event ClaimRemoved(address indexed wallet, uint256 indexed topic, address indexed issuer);
    event ContractUpgraded(address indexed newImplementation);

    // Modifiers
    modifier onlyTrustedIssuer() {
        require(trustedIssuersRegistry.isTrustedIssuer(msg.sender), "IR: caller not trusted issuer");
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

    function initialize(
        address admin,
        address _claimTopicsRegistry,
        address _trustedIssuersRegistry,
        address _upgradeAdmin
    ) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        require(_claimTopicsRegistry    != address(0), "IR: zero CTR address");
        require(_trustedIssuersRegistry != address(0), "IR: zero TIR address");
        require(_upgradeAdmin           != address(0), "IR: zero upgrade admin");

        claimTopicsRegistry    = ClaimTopicsRegistry(payable(_claimTopicsRegistry));
        trustedIssuersRegistry = TrustedIssuersRegistry(payable(_trustedIssuersRegistry));
        upgradeAdmin = _upgradeAdmin;
    }

    function proposeUpgradeAdmin(address newAdmin) external {
        require(msg.sender == upgradeAdmin, "IR: caller not upgrade admin");
        require(newAdmin != address(0), "IR: zero address");
        pendingUpgradeAdmin = newAdmin;
        emit UpgradeAdminProposed(newAdmin);
    }

    function acceptUpgradeAdmin() external {
        require(msg.sender == pendingUpgradeAdmin, "IR: caller not pending upgrade admin");
        emit UpgradeAdminTransferred(upgradeAdmin, msg.sender);
        upgradeAdmin = msg.sender;
        pendingUpgradeAdmin = address(0);
    }

    //  Identity management (onlyTrustedIssuer) 

    // Called by the trusted issuer backend after a successful KYC approval.
    function addIdentity(address wallet, bytes32 identityHash)
        external
        onlyTrustedIssuer
        whenNotPaused
    {
        require(wallet != address(0), "IR: zero wallet address");
        require(identityHash != bytes32(0), "IR: empty identity hash");
        require(!_identities[wallet].registered, "IR: identity already registered");

        _identities[wallet].identityHash  = identityHash;
        _identities[wallet].registered    = true;
        _identities[wallet].registeredAt  = block.timestamp;
        _registeredWallets.push(wallet);

        emit IdentityAdded(wallet, identityHash, block.timestamp);
    }

    // Clears all claims for the wallet. All future transfers will be blocked until re-registered.
    function removeIdentity(address wallet) external onlyTrustedIssuer whenNotPaused {
        require(_identities[wallet].registered, "IR: identity not found");

        _identities[wallet].registered = false;

        // Clear all held claims
        uint256[] memory topics = _identities[wallet].heldTopics;
        for (uint256 i = 0; i < topics.length; i++) {
            address issuer = _identities[wallet].claims[topics[i]].issuer;
            delete _identities[wallet].claims[topics[i]];
            _identities[wallet].hasTopic[topics[i]] = false;
            emit ClaimRemoved(wallet, topics[i], issuer);
        }
        delete _identities[wallet].heldTopics;

        uint256 len = _registeredWallets.length;
        for (uint256 i = 0; i < len; i++) {
            if (_registeredWallets[i] == wallet) {
                _registeredWallets[i] = _registeredWallets[len - 1];
                _registeredWallets.pop();
                break;
            }
        }

        emit IdentityRemoved(wallet, block.timestamp);
    }

    //  Claim management (onlyTrustedIssuer) 

    /**
     * @notice Writes a compliance claim to a wallet. Caller must be a registered Trusted Issuer
     *         authorized for the given topic. Called after Sumsub GREEN result.
     *         Trust model: security is enforced by onlyTrustedIssuer (access control).
     *         The calling address is the cryptographic proof — no separate signature required.
     *
     * @param wallet Investor wallet address
     * @param topic  Claim topic (1=KYC_VERIFIED, 2=ACCREDITED_INVESTOR, 3=JURISDICTION_ELIGIBLE)
     * @param data   Encoded claim data (e.g. abi.encodePacked(jurisdictionBytes2))
     * @param uri    Optional off-chain reference URI (e.g. Sumsub report link)
     */
    function addClaim(
        address wallet,
        uint256 topic,
        bytes calldata data,
        string calldata uri
    ) external onlyTrustedIssuer whenNotPaused {
        require(_identities[wallet].registered, "IR: identity not registered");
        require(claimTopicsRegistry.isClaimTopic(topic), "IR: topic not in registry");
        require(
            trustedIssuersRegistry.issuerCanWriteTopic(msg.sender, topic),
            "IR: issuer not authorized for this topic"
        );

        bool isUpdate = _identities[wallet].hasTopic[topic];

        _identities[wallet].claims[topic] = Claim({
            topic:  topic,
            issuer: msg.sender,
            data:   data,
            uri:    uri
        });

        if (!isUpdate) {
            _identities[wallet].heldTopics.push(topic);
            _identities[wallet].hasTopic[topic] = true;
        }

        emit ClaimAdded(wallet, topic, msg.sender);
    }

    function removeClaim(address wallet, uint256 topic) external onlyTrustedIssuer whenNotPaused {
        require(_identities[wallet].hasTopic[topic], "IR: claim not found");

        address issuer = _identities[wallet].claims[topic].issuer;
        delete _identities[wallet].claims[topic];
        _identities[wallet].hasTopic[topic] = false;

        uint256[] storage held = _identities[wallet].heldTopics;
        uint256 len = held.length;
        for (uint256 i = 0; i < len; i++) {
            if (held[i] == topic) {
                held[i] = held[len - 1];
                held.pop();
                break;
            }
        }

        emit ClaimRemoved(wallet, topic, issuer);
    }

    // View functions
    // Returns true only if the wallet is registered and holds all required claim topics.
    function isVerified(address wallet) external view returns (bool) {
        if (!_identities[wallet].registered) return false;

        uint256[] memory required = claimTopicsRegistry.getClaimTopics();
        for (uint256 i = 0; i < required.length; i++) {
            if (!_identities[wallet].hasTopic[required[i]]) return false;
        }
        return true;
    }

    function getIdentity(address wallet) external view returns (bytes32 identityHash, uint256 registeredAt) {
        require(_identities[wallet].registered, "IR: identity not found");
        return (_identities[wallet].identityHash, _identities[wallet].registeredAt);
    }

    function getClaim(address wallet, uint256 topic)
        external
        view
        returns (
            uint256 _topic,
            address issuer,
            bytes memory data,
            string memory uri
        )
    {
        require(_identities[wallet].hasTopic[topic], "IR: claim not found");
        Claim storage c = _identities[wallet].claims[topic];
        return (c.topic, c.issuer, c.data, c.uri);
    }

    function isRegistered(address wallet) external view returns (bool) {
        return _identities[wallet].registered;
    }

    function getHeldTopics(address wallet) external view returns (uint256[] memory) {
        return _identities[wallet].heldTopics;
    }

    function getRegisteredWallets() external view returns (address[] memory) {
        return _registeredWallets;
    }

    /**
     * @notice Paginated variant of getRegisteredWallets. Use this on mainnet to avoid
     *         out-of-gas when the registry grows large.
     * @param offset  Index of the first wallet to return.
     * @param limit   Maximum number of wallets to return per page.
     * @return wallets  Slice of the registry for the requested page.
     * @return total    Total number of registered wallets (for client-side pagination).
     */
    function getRegisteredWalletsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory wallets, uint256 total)
    {
        total = _registeredWallets.length;
        if (offset >= total || limit == 0) {
            return (new address[](0), total);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 size = end - offset;
        wallets = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            wallets[i] = _registeredWallets[offset + i];
        }
    }

    //  Emergency pause (Gnosis Safe only via owner) 

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == upgradeAdmin, "IR: caller not upgrade admin");
        require(newImplementation != address(0), "IR: zero implementation");
        require(newImplementation.code.length > 0, "IR: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("IR: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[48] private __gap;
}
