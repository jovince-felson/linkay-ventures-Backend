// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FractionalToken} from "../tokens/FractionalToken.sol";

/**
 * @title EscrowMarketplace
 * @notice Fixed-price secondary market for fractional asset tokens.
 *         Sellers list tokens at a price per token; buyers pay and receive tokens in one tx.
 *         Uses an approval-based pattern: tokens stay in the seller's wallet until purchase,
 *         so FractionalToken's KYC compliance gate fires on the actual transfer (seller -> buyer).
 *         A platform fee (in bps) is deducted from each sale and accumulated for admin withdrawal.
 * @dev UUPS upgradeable. Ownable2Step. Supports both ETH and ERC-20 payment tokens.
 */
contract EscrowMarketplace is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 1000; // 10% hard cap on platform fee

    struct Listing {
        address seller;
        address tokenContract;
        uint256 amount;
        uint256 pricePerToken;
        address paymentToken;   // address(0) = ETH, otherwise ERC-20 contract address
        bool    active;
    }

    uint256 private _nextListingId;
    uint16  public  platformFeeBps;

    mapping(uint256 => Listing) private _listings;

    // seller => tokenContract => total tokens currently listed (prevents double-listing)
    mapping(address => mapping(address => uint256)) private _listedAmounts;

    // accumulated platform fees per payment token (address(0) = ETH)
    mapping(address => uint256) private _accruedFees;

    // whitelist of accepted ERC-20 payment tokens (address(0) = ETH always allowed)
    mapping(address => bool) private _allowedPaymentTokens;

    event PaymentTokenAllowed(address indexed token);
    event PaymentTokenDisallowed(address indexed token);
    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed tokenContract,
        uint256 amount,
        uint256 pricePerToken,
        address paymentToken
    );
    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPrice,
        uint256 fee
    );
    event Cancelled(uint256 indexed listingId, address indexed seller);
    event PriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);
    event PlatformFeeUpdated(uint16 newFeeBps);
    event FeesWithdrawn(address indexed paymentToken, address indexed to, uint256 amount);
    event ContractUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    address public upgradeAdmin;
    address public pendingUpgradeAdmin;

    event UpgradeAdminTransferred(address indexed previous, address indexed next);
    event UpgradeAdminProposed(address indexed proposed);

    function initialize(address admin, uint16 _platformFeeBps, address _upgradeAdmin) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_platformFeeBps <= MAX_FEE_BPS,    "EM: fee exceeds max");
        require(_upgradeAdmin   != address(0),      "EM: zero upgrade admin");
        platformFeeBps = _platformFeeBps;
        _nextListingId = 1;
        upgradeAdmin   = _upgradeAdmin;
        _allowedPaymentTokens[address(0)] = true; // ETH always accepted
    }

    function proposeUpgradeAdmin(address newAdmin) external {
        require(msg.sender == upgradeAdmin, "EM: caller not upgrade admin");
        require(newAdmin != address(0), "EM: zero address");
        pendingUpgradeAdmin = newAdmin;
        emit UpgradeAdminProposed(newAdmin);
    }

    function acceptUpgradeAdmin() external {
        require(msg.sender == pendingUpgradeAdmin, "EM: caller not pending upgrade admin");
        emit UpgradeAdminTransferred(upgradeAdmin, msg.sender);
        upgradeAdmin = msg.sender;
        pendingUpgradeAdmin = address(0);
    }

    // List tokens for sale

    /**
     * @notice Creates a fixed-price listing. Seller must have approved this contract for at least
     *         their total listed amount (existing + new). Tokens stay in seller's wallet until purchase.
     *         This contract must be registered as an agent on the FractionalToken (owner calls addAgent).
     * @param tokenContract  FractionalToken address to list.
     * @param amount         Number of tokens to sell.
     * @param pricePerToken  Price per token in paymentToken units (or wei if ETH).
     * @param paymentToken   address(0) for ETH, ERC-20 address otherwise.
     */
    function listTokens(
        address tokenContract,
        uint256 amount,
        uint256 pricePerToken,
        address paymentToken
    ) external whenNotPaused returns (uint256 listingId) {
        require(tokenContract != address(0), "EM: zero token contract");
        require(amount         > 0,          "EM: zero amount");
        require(pricePerToken  > 0,          "EM: zero price");
        require(
            paymentToken == address(0) || _allowedPaymentTokens[paymentToken],
            "EM: payment token not allowed"
        );

        FractionalToken ft           = FractionalToken(payable(tokenContract));
        uint256 alreadyListed        = _listedAmounts[msg.sender][tokenContract];
        uint256 totalAfter           = alreadyListed + amount;

        require(ft.availableBalance(msg.sender) >= totalAfter, "EM: insufficient unlisted balance");
        require(ft.allowance(msg.sender, address(this)) >= totalAfter, "EM: insufficient allowance");

        // Freeze the listed tokens so availableBalance reflects the commitment across all venues
        ft.freezeTokens(msg.sender, amount);

        listingId = _nextListingId++;
        _listings[listingId] = Listing({
            seller:        msg.sender,
            tokenContract: tokenContract,
            amount:        amount,
            pricePerToken: pricePerToken,
            paymentToken:  paymentToken,
            active:        true
        });
        _listedAmounts[msg.sender][tokenContract] = totalAfter;

        emit Listed(listingId, msg.sender, tokenContract, amount, pricePerToken, paymentToken);
    }

    // Purchase

    /**
     * @notice Buys a listing. For ETH listings send exact msg.value. For ERC-20 listings
     *         approve this contract for totalPrice before calling.
     *         FractionalToken's compliance gate fires on the transfer — buyer must be KYC verified.
     * @param maxTotalPrice  Slippage guard: reverts if seller updated the price above this since the buyer's tx was submitted.
     */
    function purchaseListing(uint256 listingId, uint256 maxTotalPrice)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Listing storage listing = _listings[listingId];
        require(listing.active,               "EM: listing not active");
        require(listing.seller != msg.sender, "EM: seller cannot buy own listing");

        uint256 totalPrice = (listing.amount * listing.pricePerToken) / 1e18;
        require(totalPrice > 0,               "EM: price rounds to zero");
        require(totalPrice <= maxTotalPrice,   "EM: price exceeds max");
        uint256 fee        = (totalPrice * platformFeeBps) / 10000;

        // Check payment upfront before any state changes or token transfers (CEI)
        if (listing.paymentToken == address(0)) {
            require(msg.value == totalPrice, "EM: incorrect ETH amount");
        } else {
            require(msg.value == 0, "EM: ETH not accepted for ERC-20 listing");
        }

        listing.active = false;
        _listedAmounts[listing.seller][listing.tokenContract] -= listing.amount;

        // Unfreeze before transfer — compliance gate in _update blocks frozen tokens
        FractionalToken(payable(listing.tokenContract)).unfreezeTokens(listing.seller, listing.amount);

        // Transfer fractional tokens from seller directly to buyer (compliance gate fires inside).
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(listing.tokenContract).safeTransferFrom(listing.seller, msg.sender, listing.amount);

        // Settle payment
        if (listing.paymentToken == address(0)) {
            _accruedFees[address(0)] += fee;
            (bool ok,) = listing.seller.call{value: totalPrice - fee}("");
            require(ok, "EM: ETH transfer failed");
        } else {
            IERC20(listing.paymentToken).safeTransferFrom(msg.sender, address(this), totalPrice);
            _accruedFees[listing.paymentToken] += fee;
            IERC20(listing.paymentToken).safeTransfer(listing.seller, totalPrice - fee);
        }

        emit Purchased(listingId, msg.sender, listing.seller, listing.amount, totalPrice, fee);
    }

    // Cancel

    /**
     * @notice Cancels an active listing. Only the seller or platform admin can cancel.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = _listings[listingId];
        require(listing.active, "EM: listing not active");
        require(
            listing.seller == msg.sender || msg.sender == owner(),
            "EM: not seller or admin"
        );

        address seller        = listing.seller;
        address tokenContract = listing.tokenContract;

        listing.active = false;
        _listedAmounts[seller][tokenContract] -= listing.amount;

        FractionalToken(payable(tokenContract)).unfreezeTokens(seller, listing.amount);

        emit Cancelled(listingId, seller);
    }

    // Update price

    function updatePrice(uint256 listingId, uint256 newPrice) external whenNotPaused {
        Listing storage listing = _listings[listingId];
        require(listing.active,              "EM: listing not active");
        require(listing.seller == msg.sender, "EM: not seller");
        require(newPrice > 0,                "EM: zero price");

        uint256 oldPrice      = listing.pricePerToken;
        listing.pricePerToken = newPrice;

        emit PriceUpdated(listingId, oldPrice, newPrice);
    }

    // Admin

    function allowPaymentToken(address token) external onlyOwner {
        require(token != address(0), "EM: use ETH (address(0)), already allowed");
        require(token.code.length > 0, "EM: not a contract");
        _allowedPaymentTokens[token] = true;
        emit PaymentTokenAllowed(token);
    }

    function disallowPaymentToken(address token) external onlyOwner {
        require(token != address(0), "EM: cannot disallow ETH");
        _allowedPaymentTokens[token] = false;
        emit PaymentTokenDisallowed(token);
    }

    /**
     * @notice Admin recovery for a stuck listing (e.g. compliance rule change blocked settlement).
     *         Cancels the listing and unfreezes the seller's tokens.
     */
    function emergencyAdminCancel(uint256 listingId) external onlyOwner nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.active, "EM: listing not active");

        address seller        = listing.seller;
        address tokenContract = listing.tokenContract;
        uint256 amount        = listing.amount;

        listing.active = false;
        _listedAmounts[seller][tokenContract] -= amount;

        FractionalToken(payable(tokenContract)).unfreezeTokens(seller, amount);

        emit Cancelled(listingId, seller);
    }

    function setPlatformFee(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "EM: fee exceeds max");
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(newFeeBps);
    }

    function withdrawFees(address paymentToken, address to) external onlyOwner nonReentrant {
        require(to != address(0), "EM: zero recipient");
        uint256 amount = _accruedFees[paymentToken];
        require(amount > 0, "EM: no fees to withdraw");

        _accruedFees[paymentToken] = 0;

        if (paymentToken == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "EM: ETH withdrawal failed");
        } else {
            IERC20(paymentToken).safeTransfer(to, amount);
        }

        emit FeesWithdrawn(paymentToken, to, amount);
    }

    // View helpers

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }

    function getListedAmount(address seller, address tokenContract) external view returns (uint256) {
        return _listedAmounts[seller][tokenContract];
    }

    function accruedFees(address paymentToken) external view returns (uint256) {
        return _accruedFees[paymentToken];
    }

    function nextListingId() external view returns (uint256) {
        return _nextListingId;
    }

    function isPaymentTokenAllowed(address token) external view returns (bool) {
        return token == address(0) || _allowedPaymentTokens[token];
    }

    // Pause / upgrade

    function pause() external onlyOwner { _pause(); }

    function unpause() external onlyOwner { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == upgradeAdmin, "EM: caller not upgrade admin");
        require(newImplementation != address(0), "EM: zero implementation");
        require(newImplementation.code.length > 0, "EM: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    receive() external payable {
        revert("EM: no direct ETH");
    }

    uint256[47] private __gap;
}
