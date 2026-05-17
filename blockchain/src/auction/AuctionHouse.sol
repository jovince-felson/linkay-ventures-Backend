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
 * @title AuctionHouse
 * @notice English auction for fractional asset tokens. Seller sets a reserve price and
 *         minimum bid increment; highest bidder above reserve wins at auction end.
 *         Uses a pull-pattern for refunds — outbid participants call withdrawBid() to reclaim funds.
 *         Tokens stay in seller's wallet until settlement, so FractionalToken's KYC compliance
 *         gate fires on the final transfer (seller -> winner).
 *         This contract must be registered as an agent on each FractionalToken it auctions
 *         (owner calls FractionalToken.addAgent(address(auctionHouse))) so it can freeze/unfreeze
 *         seller tokens to prevent cross-venue double-commitment.
 * @dev UUPS upgradeable. Ownable2Step. Supports ETH and ERC-20 payment tokens.
 */
contract AuctionHouse is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS   = 1000;   // 10% hard cap
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 30 days;

    struct Auction {
        address seller;
        address tokenContract;
        uint256 amount;
        uint256 reservePrice;
        uint256 minBidIncrement;
        uint256 startTime;
        uint256 endTime;
        address paymentToken;    // address(0) = ETH
        address highestBidder;
        uint256 highestBid;
        bool    settled;
        bool    cancelled;
    }

    uint256 private _nextAuctionId;
    uint16  public  platformFeeBps;

    mapping(uint256 => Auction) private _auctions;

    // auctionId => bidder => amount available to withdraw (outbid refunds)
    mapping(uint256 => mapping(address => uint256)) private _pendingWithdrawals;

    // seller => tokenContract => total tokens currently locked in auctions
    mapping(address => mapping(address => uint256)) private _lockedAmounts;

    // accumulated platform fees per payment token (address(0) = ETH)
    mapping(address => uint256) private _accruedFees;

    // whitelist of accepted ERC-20 payment tokens (address(0) = ETH always allowed)
    mapping(address => bool) private _allowedPaymentTokens;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed tokenContract,
        uint256 amount,
        uint256 reservePrice,
        uint256 startTime,
        uint256 endTime,
        address paymentToken
    );
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );
    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        address indexed seller,
        uint256 winningBid,
        uint256 fee
    );
    event AuctionCancelled(uint256 indexed auctionId, address indexed seller);
    event AuctionEmergencySettled(uint256 indexed auctionId, address indexed seller, address indexed highestBidder, uint256 bidQueued);
    event BidWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event ReserveNotMet(uint256 indexed auctionId, uint256 highestBid, uint256 reservePrice);
    event PlatformFeeUpdated(uint16 newFeeBps);
    event FeesWithdrawn(address indexed paymentToken, address indexed to, uint256 amount);
    event ContractUpgraded(address indexed newImplementation);
    event PaymentTokenAllowed(address indexed token);
    event PaymentTokenDisallowed(address indexed token);

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

        require(_platformFeeBps <= MAX_FEE_BPS,   "AH: fee exceeds max");
        require(_upgradeAdmin   != address(0),     "AH: zero upgrade admin");
        platformFeeBps = _platformFeeBps;
        _nextAuctionId = 1;
        upgradeAdmin   = _upgradeAdmin;
        _allowedPaymentTokens[address(0)] = true; // ETH always accepted
    }

    function proposeUpgradeAdmin(address newAdmin) external {
        require(msg.sender == upgradeAdmin, "AH: caller not upgrade admin");
        require(newAdmin != address(0), "AH: zero address");
        pendingUpgradeAdmin = newAdmin;
        emit UpgradeAdminProposed(newAdmin);
    }

    function acceptUpgradeAdmin() external {
        require(msg.sender == pendingUpgradeAdmin, "AH: caller not pending upgrade admin");
        emit UpgradeAdminTransferred(upgradeAdmin, msg.sender);
        upgradeAdmin = msg.sender;
        pendingUpgradeAdmin = address(0);
    }

    // ── Create auction ────────────────────────────────────────────────────────

    /**
     * @notice Creates an English auction. Seller must approve this contract for at least `amount`
     *         tokens (on top of any other locked amounts) before calling.
     *         This contract must be a registered agent on the FractionalToken.
     * @param tokenContract    FractionalToken to auction.
     * @param amount           Number of tokens being auctioned.
     * @param reservePrice     Minimum winning bid. If not met, tokens return to seller.
     * @param minBidIncrement  Each new bid must exceed current highest by at least this amount.
     * @param startTime        Unix timestamp when bidding opens. Must be >= block.timestamp.
     * @param endTime          Unix timestamp when bidding closes.
     * @param paymentToken     address(0) for ETH, ERC-20 address otherwise.
     */
    function createAuction(
        address tokenContract,
        uint256 amount,
        uint256 reservePrice,
        uint256 minBidIncrement,
        uint256 startTime,
        uint256 endTime,
        address paymentToken
    ) external whenNotPaused returns (uint256 auctionId) {
        require(tokenContract    != address(0),      "AH: zero token contract");
        require(amount            > 0,               "AH: zero amount");
        require(reservePrice      > 0,               "AH: zero reserve price");
        require(minBidIncrement   > 0,               "AH: zero min bid increment");
        require(startTime        >= block.timestamp,  "AH: start in the past");
        require(endTime           > startTime,        "AH: end before start");
        require(endTime - startTime >= MIN_DURATION,  "AH: duration too short");
        require(endTime - startTime <= MAX_DURATION,  "AH: duration too long");
        require(
            paymentToken == address(0) || _allowedPaymentTokens[paymentToken],
            "AH: payment token not allowed"
        );

        FractionalToken ft    = FractionalToken(payable(tokenContract));
        uint256 alreadyLocked = _lockedAmounts[msg.sender][tokenContract];
        uint256 totalAfter    = alreadyLocked + amount;

        require(ft.availableBalance(msg.sender) >= totalAfter, "AH: insufficient unlocked balance");
        require(ft.allowance(msg.sender, address(this)) >= totalAfter, "AH: insufficient allowance");

        // Freeze tokens to prevent cross-venue double-commitment
        ft.freezeTokens(msg.sender, amount);

        auctionId = _nextAuctionId++;
        _auctions[auctionId] = Auction({
            seller:          msg.sender,
            tokenContract:   tokenContract,
            amount:          amount,
            reservePrice:    reservePrice,
            minBidIncrement: minBidIncrement,
            startTime:       startTime,
            endTime:         endTime,
            paymentToken:    paymentToken,
            highestBidder:   address(0),
            highestBid:      0,
            settled:         false,
            cancelled:       false
        });
        _lockedAmounts[msg.sender][tokenContract] = totalAfter;

        emit AuctionCreated(auctionId, msg.sender, tokenContract, amount, reservePrice, startTime, endTime, paymentToken);
    }

    // ── Place bid ─────────────────────────────────────────────────────────────

    /**
     * @notice Places a bid. For ETH auctions send exact msg.value. For ERC-20 auctions
     *         approve this contract for `bidAmount` before calling.
     *         Each bid must exceed the current highest by at least minBidIncrement.
     *         Outbid amounts are stored for withdrawal via withdrawBid().
     */
    function placeBid(uint256 auctionId, uint256 bidAmount)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Auction storage auction = _auctions[auctionId];
        require(!auction.settled && !auction.cancelled, "AH: auction not active");
        require(block.timestamp >= auction.startTime,   "AH: auction not started");
        require(block.timestamp <  auction.endTime,     "AH: auction ended");
        require(auction.seller != msg.sender,           "AH: seller cannot bid");

        uint256 minRequired = auction.highestBid == 0
            ? auction.reservePrice
            : auction.highestBid + auction.minBidIncrement;

        require(bidAmount >= minRequired, "AH: bid too low");
        require(!FractionalToken(payable(auction.tokenContract)).paused(), "AH: token is paused");

        // Accept payment
        if (auction.paymentToken == address(0)) {
            require(msg.value == bidAmount, "AH: incorrect ETH amount");
        } else {
            require(msg.value == 0, "AH: ETH not accepted for ERC-20 auction");
            IERC20(auction.paymentToken).safeTransferFrom(msg.sender, address(this), bidAmount);
        }

        // Queue previous highest bid for withdrawal
        if (auction.highestBidder != address(0)) {
            _pendingWithdrawals[auctionId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBidder = msg.sender;
        auction.highestBid    = bidAmount;

        emit BidPlaced(auctionId, msg.sender, bidAmount);
    }

    // ── Settle ────────────────────────────────────────────────────────────────

    /**
     * @notice Settles the auction after endTime. Anyone can call this.
     *         If reserve is met: tokens transferred to winner, payment to seller minus fee.
     *         If reserve not met: tokens stay with seller, highest bid queued for withdrawal.
     */
    function settleAuction(uint256 auctionId) external whenNotPaused nonReentrant {
        Auction storage auction = _auctions[auctionId];
        require(!auction.settled && !auction.cancelled, "AH: auction not active");
        require(block.timestamp >= auction.endTime,     "AH: auction not ended");

        auction.settled = true;
        _lockedAmounts[auction.seller][auction.tokenContract] -= auction.amount;

        // Always unfreeze — whether reserve met or not, the tokens are no longer committed
        FractionalToken(payable(auction.tokenContract)).unfreezeTokens(auction.seller, auction.amount);

        if (auction.highestBidder == address(0) || auction.highestBid < auction.reservePrice) {
            // No valid bids or reserve not met — queue refund if there was a bid
            if (auction.highestBidder != address(0)) {
                _pendingWithdrawals[auctionId][auction.highestBidder] += auction.highestBid;
                emit ReserveNotMet(auctionId, auction.highestBid, auction.reservePrice);
            }
            return;
        }

        uint256 fee            = (auction.highestBid * platformFeeBps) / 10000;
        uint256 sellerProceeds = auction.highestBid - fee;

        _accruedFees[auction.paymentToken] += fee;

        // Transfer tokens from seller to winner (KYC compliance gate fires here)
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(auction.tokenContract).safeTransferFrom(auction.seller, auction.highestBidder, auction.amount);

        // Pay seller
        if (auction.paymentToken == address(0)) {
            (bool ok,) = auction.seller.call{value: sellerProceeds}("");
            require(ok, "AH: ETH transfer to seller failed");
        } else {
            IERC20(auction.paymentToken).safeTransfer(auction.seller, sellerProceeds);
        }

        emit AuctionSettled(auctionId, auction.highestBidder, auction.seller, auction.highestBid, fee);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    /**
     * @notice Cancels an auction. Only allowed before any bids are placed.
     *         Seller or admin can cancel.
     */
    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = _auctions[auctionId];
        require(!auction.settled && !auction.cancelled, "AH: auction not active");
        require(auction.highestBidder == address(0),   "AH: bids already placed");
        require(
            auction.seller == msg.sender || msg.sender == owner(),
            "AH: not seller or admin"
        );

        auction.cancelled = true;
        _lockedAmounts[auction.seller][auction.tokenContract] -= auction.amount;

        FractionalToken(payable(auction.tokenContract)).unfreezeTokens(auction.seller, auction.amount);

        emit AuctionCancelled(auctionId, auction.seller);
    }

    // ── Withdraw outbid funds ─────────────────────────────────────────────────

    /**
     * @notice Withdraws funds queued from being outbid or from a failed auction (reserve not met).
     */
    function withdrawBid(uint256 auctionId) external nonReentrant {
        uint256 amount = _pendingWithdrawals[auctionId][msg.sender];
        require(amount > 0, "AH: nothing to withdraw");

        _pendingWithdrawals[auctionId][msg.sender] = 0;

        address paymentToken = _auctions[auctionId].paymentToken;
        if (paymentToken == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "AH: ETH withdrawal failed");
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, amount);
        }

        emit BidWithdrawn(auctionId, msg.sender, amount);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Admin escape hatch for a stuck auction — e.g. winner's KYC revoked after bidding,
     *         making settleAuction revert every time on the compliance transfer.
     *         Skips the token transfer entirely: unfreezes seller tokens and queues the
     *         winner's bid in _pendingWithdrawals so they can call withdrawBid().
     *         No tokens move; both parties recover their assets.
     */
    function emergencyAdminSettle(uint256 auctionId) external onlyOwner nonReentrant {
        Auction storage auction = _auctions[auctionId];
        require(!auction.settled && !auction.cancelled, "AH: auction not active");
        require(block.timestamp >= auction.endTime,     "AH: auction still live");

        auction.settled = true;
        _lockedAmounts[auction.seller][auction.tokenContract] -= auction.amount;

        FractionalToken(payable(auction.tokenContract)).unfreezeTokens(auction.seller, auction.amount);

        uint256 bidQueued = 0;
        if (auction.highestBidder != address(0)) {
            bidQueued = auction.highestBid;
            _pendingWithdrawals[auctionId][auction.highestBidder] += bidQueued;
        }

        emit AuctionEmergencySettled(auctionId, auction.seller, auction.highestBidder, bidQueued);
    }

    function allowPaymentToken(address token) external onlyOwner {
        require(token != address(0), "AH: use ETH (address(0)), already allowed");
        require(token.code.length > 0, "AH: not a contract");
        _allowedPaymentTokens[token] = true;
        emit PaymentTokenAllowed(token);
    }

    function disallowPaymentToken(address token) external onlyOwner {
        require(token != address(0), "AH: cannot disallow ETH");
        _allowedPaymentTokens[token] = false;
        emit PaymentTokenDisallowed(token);
    }

    function isPaymentTokenAllowed(address token) external view returns (bool) {
        return token == address(0) || _allowedPaymentTokens[token];
    }

    function setPlatformFee(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "AH: fee exceeds max");
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(newFeeBps);
    }

    function withdrawFees(address paymentToken, address to) external onlyOwner nonReentrant {
        require(to != address(0), "AH: zero recipient");
        uint256 amount = _accruedFees[paymentToken];
        require(amount > 0, "AH: no fees to withdraw");

        _accruedFees[paymentToken] = 0;

        if (paymentToken == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "AH: ETH withdrawal failed");
        } else {
            IERC20(paymentToken).safeTransfer(to, amount);
        }

        emit FeesWithdrawn(paymentToken, to, amount);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return _auctions[auctionId];
    }

    function pendingWithdrawal(uint256 auctionId, address bidder) external view returns (uint256) {
        return _pendingWithdrawals[auctionId][bidder];
    }

    function lockedAmount(address seller, address tokenContract) external view returns (uint256) {
        return _lockedAmounts[seller][tokenContract];
    }

    function accruedFees(address paymentToken) external view returns (uint256) {
        return _accruedFees[paymentToken];
    }

    function nextAuctionId() external view returns (uint256) {
        return _nextAuctionId;
    }

    // ── Pause / upgrade ───────────────────────────────────────────────────────

    function pause() external onlyOwner { _pause(); }

    function unpause() external onlyOwner { _unpause(); }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == upgradeAdmin, "AH: caller not upgrade admin");
        require(newImplementation != address(0), "AH: zero implementation");
        require(newImplementation.code.length > 0, "AH: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    receive() external payable {
        revert("AH: no direct ETH");
    }

    uint256[41] private __gap;
}
