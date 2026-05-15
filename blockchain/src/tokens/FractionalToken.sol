// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IdentityRegistry} from "../compliance/IdentityRegistry.sol";
import {ComplianceModule} from "../compliance/ComplianceModule.sol";

/**
 * @title FractionalToken
 * @notice ERC-3643 (T-REX) compliant fractional ownership token for a tokenized real-world asset.
 *         Every transfer is validated against IdentityRegistry and ComplianceModule  -  unverified
 *         wallets cannot receive tokens at the contract level, regardless of backend state.
 *         One contract is deployed per asset via FractionalTokenFactory.
 * @dev Uses OwnableUpgradeable (not Ownable2Step) so the factory can atomically call
 *      mintInitialSupply() then transferOwnership() in a single transaction.
 */
contract FractionalToken is
    Initializable,
    ERC20Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public assetId;          // links back to platform asset UUID
    uint256 public totalSupplyCap;   // immutable after mint
    bool    public supplyMinted;
    uint16  public tokenizeBps;      // basis points tokenized publicly (1-10000)

    IdentityRegistry public identityRegistry;
    ComplianceModule public complianceModule;

    // wallet => frozen token amount (excluded from transfer)
    mapping(address => uint256) private _frozenTokens;

    // Authorized agents (backend signers for freeze/unfreeze/forcedTransfer)
    mapping(address => bool) private _agents;

    // Events
    event InitialSupplyMinted(address indexed treasury, address indexed assetOwner, uint256 publicAmount, uint256 retainedAmount, uint16 tokenizeBps);
    event TokensFrozen(address indexed wallet, uint256 amount, address indexed agent);
    event TokensUnfrozen(address indexed wallet, uint256 amount, address indexed agent);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, address indexed agent);
    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);
    event ComplianceModuleUpdated(address indexed newModule);
    event ContractUpgraded(address indexed newImplementation);

    // Modifiers
    modifier onlyAgent() {
        require(_agents[msg.sender] || msg.sender == owner(), "FT: caller not agent");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 _totalSupplyCap,
        bytes32 _assetId,
        address _identityRegistry,
        address _complianceModule,
        address admin
    ) external initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(admin);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_totalSupplyCap > 0, "FT: zero supply cap");
        require(_identityRegistry != address(0), "FT: zero IR");
        require(_complianceModule  != address(0), "FT: zero CM");

        assetId         = _assetId;
        totalSupplyCap  = _totalSupplyCap;
        identityRegistry = IdentityRegistry(payable(_identityRegistry));
        complianceModule = ComplianceModule(payable(_complianceModule));
    }

    //  Mint (one-time, called by factory in job step 5) 

    /**
     * @notice Mints the initial supply split between treasury (public sale) and asset owner (retained stake).
     * @param treasuryWallet    Receives the publicly tokenized portion (goes to marketplace).
     * @param assetOwnerWallet  Receives the retained portion. May be address(0) if tokenizeBps == 10000.
     * @param publicAmount      Tokens for public sale = totalSupplyCap * tokenizeBps / 10000.
     * @param retainedAmount    Tokens retained by owner = totalSupplyCap - publicAmount.
     * @param _tokenizeBps      Basis points tokenized (1-10000). Stored on-chain for transparency.
     */
    function mintInitialSupply(
        address treasuryWallet,
        address assetOwnerWallet,
        uint256 publicAmount,
        uint256 retainedAmount,
        uint16  _tokenizeBps
    ) external onlyOwner whenNotPaused nonReentrant {
        require(!supplyMinted, "FT: supply already minted");
        require(treasuryWallet != address(0), "FT: zero treasury");
        require(publicAmount > 0, "FT: zero public amount");
        require(publicAmount + retainedAmount == totalSupplyCap, "FT: amounts must equal supply cap");
        require(_tokenizeBps >= 1 && _tokenizeBps <= 10000, "FT: invalid tokenize bps");
        if (retainedAmount > 0) {
            require(assetOwnerWallet != address(0), "FT: zero asset owner");
        }

        tokenizeBps = _tokenizeBps;
        supplyMinted = true;
        _mint(treasuryWallet, publicAmount);
        if (retainedAmount > 0) {
            _mint(assetOwnerWallet, retainedAmount);
        }
        emit InitialSupplyMinted(treasuryWallet, assetOwnerWallet, publicAmount, retainedAmount, _tokenizeBps);
    }

    //  ERC-3643 compliant transfer 

    // Skips compliance on mint (from=0) and burn (to=0); enforces it on all transfers.
    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        // Skip compliance check for mint (from=0) and burn (to=0)
        if (from != address(0) && to != address(0)) {
            _enforceCompliance(from, to, amount);
        }
        super._update(from, to, amount);
    }

    function _enforceCompliance(address from, address to, uint256 amount) internal view {
        // Check frozen balance  -  sender must have enough unfrozen tokens
        uint256 unfrozen = balanceOf(from) - _frozenTokens[from];
        require(amount <= unfrozen, "FT: insufficient unfrozen balance");

        // Validate via compliance module
        (bool valid, string memory reason) = complianceModule.isTransferValid(assetId, from, to, amount);
        require(valid, reason);
    }

    //  Freeze / unfreeze (onlyAgent) 

    function freezeTokens(address wallet, uint256 amount) external onlyAgent whenNotPaused {
        require(wallet != address(0), "FT: zero wallet");
        require(amount > 0, "FT: zero amount");
        require(
            _frozenTokens[wallet] + amount <= balanceOf(wallet),
            "FT: freeze exceeds balance"
        );
        _frozenTokens[wallet] += amount;
        emit TokensFrozen(wallet, amount, msg.sender);
    }

    function unfreezeTokens(address wallet, uint256 amount) external onlyAgent whenNotPaused {
        require(wallet != address(0), "FT: zero wallet");
        require(amount > 0, "FT: zero amount");
        require(_frozenTokens[wallet] >= amount, "FT: insufficient frozen balance");
        _frozenTokens[wallet] -= amount;
        emit TokensUnfrozen(wallet, amount, msg.sender);
    }

    //  Forced transfer (admin only, dual approval required off-chain) 

    /**
     * @notice Bypasses normal transfer restrictions. For regulatory or court-order use only.
     *         Reduces frozen balance proportionally if the sender has frozen tokens.
     */
    function forcedTransfer(address from, address to, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        require(from != address(0) && to != address(0), "FT: zero address");
        require(amount > 0, "FT: zero amount");
        require(balanceOf(from) >= amount, "FT: insufficient balance");
        require(identityRegistry.isVerified(to), "FT: recipient not KYC verified");

        // Reduce frozen balance proportionally if needed
        if (_frozenTokens[from] > 0) {
            uint256 deductFrozen = amount < _frozenTokens[from] ? amount : _frozenTokens[from];
            _frozenTokens[from] -= deductFrozen;
        }

        _transfer(from, to, amount);
        emit ForcedTransfer(from, to, amount, msg.sender);
    }

    // Agent management
    function addAgent(address agent) external onlyOwner {
        require(agent != address(0), "FT: zero address");
        _agents[agent] = true;
        emit AgentAdded(agent);
    }

    function removeAgent(address agent) external onlyOwner {
        _agents[agent] = false;
        emit AgentRemoved(agent);
    }

    // View functions
    function frozenTokens(address wallet) external view returns (uint256) {
        return _frozenTokens[wallet];
    }

    function availableBalance(address wallet) external view returns (uint256) {
        return balanceOf(wallet) - _frozenTokens[wallet];
    }

    function isAgent(address account) external view returns (bool) {
        return _agents[account];
    }

    // Compliance module update
    function setComplianceModule(address newModule) external onlyOwner {
        require(newModule != address(0), "FT: zero module");
        require(newModule.code.length > 0, "FT: not a contract");
        complianceModule = ComplianceModule(payable(newModule));
        emit ComplianceModuleUpdated(newModule);
    }

    // Pause / upgrade
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "FT: zero implementation");
        require(newImplementation.code.length > 0, "FT: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("FT: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[50] private __gap;
}
