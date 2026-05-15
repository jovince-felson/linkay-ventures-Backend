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

    function initialize(address admin, uint16 _platformFeeBps) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_platformFeeBps <= MAX_FEE_BPS, "EM: fee exceeds max");
        platformFeeBps = _platformFeeBps;
        _nextListingId = 1;
    }

    // List tokens for sale

    /**
     * @notice Creates a fixed-price listing. Seller must have approved this contract for at least
     *         their total listed amount (existing + new). Tokens stay in seller's wallet until purchase.
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

        FractionalToken ft           = FractionalToken(payable(tokenContract));
        uint256 alreadyListed        = _listedAmounts[msg.sender][tokenContract];
        uint256 totalAfter           = alreadyListed + amount;

        require(ft.availableBalance(msg.sender) >= totalAfter, "EM: insufficient unlisted balance");
        require(ft.allowance(msg.sender, address(this)) >= totalAfter, "EM: insufficient allowance");

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
     */
    function purchaseListing(uint256 listingId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Listing storage listing = _listings[listingId];
        require(listing.active,                    "EM: listing not active");
        require(listing.seller != msg.sender,      "EM: seller cannot buy own listing");

        uint256 totalPrice      = (listing.amount * listing.pricePerToken) / 1e18;
        uint256 fee             = (totalPrice * platformFeeBps) / 10000;
        uint256 sellerProceeds  = totalPrice - fee;

        address seller        = listing.seller;
        address tokenContract = listing.tokenContract;
        uint256 amount        = listing.amount;
        address paymentToken  = listing.paymentToken;

        listing.active = false;
        _listedAmounts[seller][tokenContract] -= amount;

        // Transfer fractional tokens from seller directly to buyer (compliance checked inside)
        FractionalToken(payable(tokenContract)).transferFrom(seller, msg.sender, amount);

        // Settle payment
        if (paymentToken == address(0)) {
            require(msg.value == totalPrice, "EM: incorrect ETH amount");
            _accruedFees[address(0)] += fee;
            (bool ok,) = seller.call{value: sellerProceeds}("");
            require(ok, "EM: ETH transfer failed");
        } else {
            require(msg.value == 0, "EM: ETH not accepted for ERC-20 listing");
            IERC20 token = IERC20(paymentToken);
            token.safeTransferFrom(msg.sender, address(this), totalPrice);
            _accruedFees[paymentToken] += fee;
            token.safeTransfer(seller, sellerProceeds);
        }

        emit Purchased(listingId, msg.sender, seller, amount, totalPrice, fee);
    }

    // Cancel

    /**
     * @notice Cancels an active listing. Only the seller or platform admin can cancel.
     */
    function cancelListing(uint256 listingId) external whenNotPaused {
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

    // Pause / upgrade

    function pause() external onlyOwner { _pause(); }

    function unpause() external onlyOwner { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "EM: zero implementation");
        require(newImplementation.code.length > 0, "EM: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    receive() external payable {}

    uint256[50] private __gap;
}
