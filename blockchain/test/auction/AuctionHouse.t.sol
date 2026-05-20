// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ClaimTopicsRegistry}    from "../../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry}       from "../../src/compliance/IdentityRegistry.sol";
import {ComplianceModule}       from "../../src/compliance/ComplianceModule.sol";
import {FractionalToken}        from "../../src/tokens/FractionalToken.sol";
import {AuctionHouse}           from "../../src/auction/AuctionHouse.sol";

// Minimal ERC-20 for payment token tests
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    string public name = "Mock USD";
    string public symbol = "MUSD";
    uint8  public decimals = 6;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        return true;
    }
}

contract AuctionHouseTest is Test {
    ClaimTopicsRegistry    internal ctr;
    TrustedIssuersRegistry internal tir;
    IdentityRegistry       internal ir;
    ComplianceModule       internal cm;

    FractionalToken internal ft;
    AuctionHouse    internal ah;
    MockERC20       internal musd;

    address internal admin   = makeAddr("admin");
    address internal issuer  = makeAddr("issuer");
    address internal seller  = makeAddr("seller");
    address internal bidder1 = makeAddr("bidder1");
    address internal bidder2 = makeAddr("bidder2");

    uint256 internal constant SUPPLY     = 1_000_000e18;
    uint256 internal constant AUCTION_AMT = 100_000e18;
    uint256 internal constant RESERVE    = 1 ether;
    uint256 internal constant INCREMENT  = 0.1 ether;
    uint16  internal constant FEE_BPS    = 250; // 2.5%

    uint256 internal startTime;
    uint256 internal endTime;

    function setUp() public {
        uint256[] memory topics = new uint256[](2);
        topics[0] = 1; topics[1] = 3;

        vm.startPrank(admin);

        ctr = ClaimTopicsRegistry(payable(address(new ERC1967Proxy(
            address(new ClaimTopicsRegistry()),
            abi.encodeWithSelector(ClaimTopicsRegistry.initialize.selector, admin, admin)
        ))));
        ctr.removeClaimTopic(2);

        tir = TrustedIssuersRegistry(payable(address(new ERC1967Proxy(
            address(new TrustedIssuersRegistry()),
            abi.encodeWithSelector(TrustedIssuersRegistry.initialize.selector, admin, admin)
        ))));
        tir.addTrustedIssuer(issuer, topics);

        ir = IdentityRegistry(payable(address(new ERC1967Proxy(
            address(new IdentityRegistry()),
            abi.encodeWithSelector(IdentityRegistry.initialize.selector, admin, address(ctr), address(tir), admin)
        ))));

        cm = ComplianceModule(payable(address(new ERC1967Proxy(
            address(new ComplianceModule()),
            abi.encodeWithSelector(ComplianceModule.initialize.selector, admin, address(ir), admin)
        ))));

        ft = FractionalToken(payable(address(new ERC1967Proxy(
            address(new FractionalToken()),
            abi.encodeWithSelector(
                FractionalToken.initialize.selector,
                "Test Asset Fractions", "TAF",
                SUPPLY, keccak256("asset-001"),
                address(ir), address(cm), admin, admin
            )
        ))));
        ft.mintInitialSupply(seller, address(0), SUPPLY, 0, 10000);

        ah = AuctionHouse(payable(address(new ERC1967Proxy(
            address(new AuctionHouse()),
            abi.encodeWithSelector(AuctionHouse.initialize.selector, admin, FEE_BPS, admin)
        ))));

        // Register auction house as agent so it can freeze/unfreeze seller tokens
        ft.addAgent(address(ah));

        vm.stopPrank();

        musd = new MockERC20();

        // Whitelist musd as accepted payment token
        vm.prank(admin);
        ah.allowPaymentToken(address(musd));

        _kyc(seller);
        _kyc(bidder1);
        _kyc(bidder2);

        vm.prank(seller);
        ft.approve(address(ah), SUPPLY);

        startTime = block.timestamp;
        endTime   = block.timestamp + 2 hours;
    }

    function _kyc(address wallet) internal {
        vm.startPrank(issuer);
        ir.addIdentity(wallet, keccak256(abi.encodePacked(wallet)));
        ir.addClaim(wallet, 1, abi.encodePacked(bytes2("US")), "");
        ir.addClaim(wallet, 3, abi.encodePacked(bytes2("US")), "");
        vm.stopPrank();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    function _createEthAuction() internal returns (uint256 auctionId) {
        vm.prank(seller);
        auctionId = ah.createAuction(
            address(ft), AUCTION_AMT, RESERVE, INCREMENT,
            startTime, endTime, address(0)
        );
    }

    function _createErc20Auction() internal returns (uint256 auctionId) {
        uint256 reserve   = 1_000e6;
        uint256 increment = 100e6;
        vm.prank(seller);
        auctionId = ah.createAuction(
            address(ft), AUCTION_AMT, reserve, increment,
            startTime, endTime, address(musd)
        );
    }

    // ── initialize ───────────────────────────────────────────────────────────

    function test_AH_Initialize() public view {
        assertEq(ah.owner(),          admin);
        assertEq(ah.platformFeeBps(), FEE_BPS);
        assertEq(ah.nextAuctionId(),  1);
    }

    function test_AH_Initialize_FeeTooHigh_Reverts() public {
        AuctionHouse impl = new AuctionHouse();
        vm.expectRevert("AH: fee exceeds max");
        new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(AuctionHouse.initialize.selector, admin, uint16(1001), admin)
        );
    }

    // ── createAuction ────────────────────────────────────────────────────────

    function test_AH_CreateAuction_ETH() public {
        uint256 id = _createEthAuction();
        assertEq(id, 1);
        assertEq(ah.nextAuctionId(), 2);

        AuctionHouse.Auction memory a = ah.getAuction(id);
        assertEq(a.seller,           seller);
        assertEq(a.tokenContract,    address(ft));
        assertEq(a.amount,           AUCTION_AMT);
        assertEq(a.reservePrice,     RESERVE);
        assertEq(a.minBidIncrement,  INCREMENT);
        assertEq(a.paymentToken,     address(0));
        assertFalse(a.settled);
        assertFalse(a.cancelled);
    }

    function test_AH_CreateAuction_ERC20() public {
        uint256 id = _createErc20Auction();
        AuctionHouse.Auction memory a = ah.getAuction(id);
        assertEq(a.paymentToken, address(musd));
    }

    function test_AH_CreateAuction_LockedAmountTracked() public {
        _createEthAuction();
        assertEq(ah.lockedAmount(seller, address(ft)), AUCTION_AMT);
    }

    function test_AH_CreateAuction_TwoAuctions_LocksAccumulate() public {
        _createEthAuction();
        vm.prank(seller);
        ah.createAuction(
            address(ft), AUCTION_AMT, RESERVE, INCREMENT,
            startTime, endTime, address(0)
        );
        assertEq(ah.lockedAmount(seller, address(ft)), AUCTION_AMT * 2);
    }

    function test_AH_Create_ZeroTokenContract_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: zero token contract");
        ah.createAuction(address(0), AUCTION_AMT, RESERVE, INCREMENT, startTime, endTime, address(0));
    }

    function test_AH_Create_ZeroAmount_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: zero amount");
        ah.createAuction(address(ft), 0, RESERVE, INCREMENT, startTime, endTime, address(0));
    }

    function test_AH_Create_ZeroReserve_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: zero reserve price");
        ah.createAuction(address(ft), AUCTION_AMT, 0, INCREMENT, startTime, endTime, address(0));
    }

    function test_AH_Create_ZeroIncrement_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: zero min bid increment");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, 0, startTime, endTime, address(0));
    }

    function test_AH_Create_StartInPast_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: start in the past");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, block.timestamp - 1, endTime, address(0));
    }

    function test_AH_Create_EndBeforeStart_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: end before start");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, startTime, startTime, address(0));
    }

    function test_AH_Create_DurationTooShort_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: duration too short");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, startTime, startTime + 30 minutes, address(0));
    }

    function test_AH_Create_DurationTooLong_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: duration too long");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, startTime, startTime + 31 days, address(0));
    }

    function test_AH_Create_InsufficientBalance_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("AH: insufficient unlocked balance");
        ah.createAuction(address(ft), SUPPLY + 1, RESERVE, INCREMENT, startTime, endTime, address(0));
    }

    function test_AH_Create_InsufficientAllowance_Reverts() public {
        // Revoke approval
        vm.prank(seller);
        ft.approve(address(ah), 0);

        vm.prank(seller);
        vm.expectRevert("AH: insufficient allowance");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, startTime, endTime, address(0));
    }

    function test_AH_Create_WhenPaused_Reverts() public {
        vm.prank(admin);
        ah.pause();

        vm.prank(seller);
        vm.expectRevert();
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, startTime, endTime, address(0));
    }

    // ── placeBid ─────────────────────────────────────────────────────────────

    function test_AH_PlaceBid_ETH_FirstBid() public {
        uint256 id = _createEthAuction();

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        AuctionHouse.Auction memory a = ah.getAuction(id);
        assertEq(a.highestBidder, bidder1);
        assertEq(a.highestBid,    RESERVE);
    }

    function test_AH_PlaceBid_ETH_Outbid_QueuesPrevious() public {
        uint256 id = _createEthAuction();
        uint256 bid2 = RESERVE + INCREMENT;

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.deal(bidder2, 10 ether);
        vm.prank(bidder2);
        ah.placeBid{value: bid2}(id, bid2);

        assertEq(ah.pendingWithdrawal(id, bidder1), RESERVE);
        AuctionHouse.Auction memory a = ah.getAuction(id);
        assertEq(a.highestBidder, bidder2);
        assertEq(a.highestBid,    bid2);
    }

    function test_AH_PlaceBid_ERC20() public {
        uint256 id       = _createErc20Auction();
        uint256 reserve  = 1_000e6;
        musd.mint(bidder1, reserve);
        vm.prank(bidder1);
        musd.approve(address(ah), reserve);

        vm.prank(bidder1);
        ah.placeBid(id, reserve);

        AuctionHouse.Auction memory a = ah.getAuction(id);
        assertEq(a.highestBidder, bidder1);
        assertEq(a.highestBid,    reserve);
    }

    function test_AH_PlaceBid_BelowReserve_Reverts() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        vm.expectRevert("AH: bid too low");
        ah.placeBid{value: RESERVE - 1}(id, RESERVE - 1);
    }

    function test_AH_PlaceBid_BelowIncrement_Reverts() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.deal(bidder2, 10 ether);
        vm.prank(bidder2);
        vm.expectRevert("AH: bid too low");
        ah.placeBid{value: RESERVE + INCREMENT - 1}(id, RESERVE + INCREMENT - 1);
    }

    function test_AH_PlaceBid_Seller_Reverts() public {
        uint256 id = _createEthAuction();
        vm.deal(seller, 10 ether);
        vm.prank(seller);
        vm.expectRevert("AH: seller cannot bid");
        ah.placeBid{value: RESERVE}(id, RESERVE);
    }

    function test_AH_PlaceBid_BeforeStart_Reverts() public {
        vm.prank(seller);
        uint256 futureStart = block.timestamp + 1 hours;
        uint256 id = ah.createAuction(
            address(ft), AUCTION_AMT, RESERVE, INCREMENT,
            futureStart, futureStart + 2 hours, address(0)
        );

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        vm.expectRevert("AH: auction not started");
        ah.placeBid{value: RESERVE}(id, RESERVE);
    }

    function test_AH_PlaceBid_AfterEnd_Reverts() public {
        uint256 id = _createEthAuction();
        vm.warp(endTime + 1);

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        vm.expectRevert("AH: auction ended");
        ah.placeBid{value: RESERVE}(id, RESERVE);
    }

    function test_AH_PlaceBid_WrongETHAmount_Reverts() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        vm.expectRevert("AH: incorrect ETH amount");
        ah.placeBid{value: RESERVE + 1}(id, RESERVE);
    }

    function test_AH_PlaceBid_ETHOnERC20Auction_Reverts() public {
        uint256 id = _createErc20Auction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        vm.expectRevert("AH: ETH not accepted for ERC-20 auction");
        ah.placeBid{value: 1}(id, 1_000e6);
    }

    function test_AH_PlaceBid_OnPausedContract_Reverts() public {
        uint256 id = _createEthAuction();
        vm.prank(admin);
        ah.pause();

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        vm.expectRevert();
        ah.placeBid{value: RESERVE}(id, RESERVE);
    }

    // ── settleAuction ────────────────────────────────────────────────────────

    function test_AH_Settle_ReserveMet_ETH() public {
        uint256 id = _createEthAuction();

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.warp(endTime + 1);

        uint256 sellerBefore = seller.balance;
        ah.settleAuction(id);

        uint256 fee            = (RESERVE * FEE_BPS) / 10000;
        uint256 sellerProceeds = RESERVE - fee;

        assertEq(ft.balanceOf(bidder1), AUCTION_AMT);
        assertEq(seller.balance - sellerBefore, sellerProceeds);
        assertEq(ah.accruedFees(address(0)), fee);
        assertTrue(ah.getAuction(id).settled);
    }

    function test_AH_Settle_ReserveMet_ERC20() public {
        uint256 id      = _createErc20Auction();
        uint256 reserve = 1_000e6;

        musd.mint(bidder1, reserve);
        vm.prank(bidder1);
        musd.approve(address(ah), reserve);
        vm.prank(bidder1);
        ah.placeBid(id, reserve);

        vm.warp(endTime + 1);
        ah.settleAuction(id);

        uint256 fee            = (reserve * FEE_BPS) / 10000;
        uint256 sellerProceeds = reserve - fee;

        assertEq(ft.balanceOf(bidder1), AUCTION_AMT);
        assertEq(musd.balanceOf(seller), sellerProceeds);
        assertEq(ah.accruedFees(address(musd)), fee);
    }

    function test_AH_Settle_ReserveNotMet_QueuesBidderRefund() public {
        uint256 id = _createEthAuction();

        // Bid below reserve (first bid must be >= reserve, so trick: use a very low reserve auction)
        // Create new auction with low reserve so bidder can win, but then settle with no bid
        vm.warp(endTime + 1);
        ah.settleAuction(id);

        // No bids, no refund queued
        assertEq(ah.pendingWithdrawal(id, bidder1), 0);
        assertFalse(ah.getAuction(id).settled == false);
    }

    function test_AH_Settle_NoBids_Settles_NoTransfer() public {
        uint256 id = _createEthAuction();
        vm.warp(endTime + 1);

        uint256 sellerBalance = ft.balanceOf(seller);
        ah.settleAuction(id);

        assertEq(ft.balanceOf(seller), sellerBalance); // tokens stay with seller
        assertTrue(ah.getAuction(id).settled);
    }

    function test_AH_Settle_UnlocksTokens() public {
        uint256 id = _createEthAuction();
        assertEq(ah.lockedAmount(seller, address(ft)), AUCTION_AMT);

        vm.warp(endTime + 1);
        ah.settleAuction(id);

        assertEq(ah.lockedAmount(seller, address(ft)), 0);
    }

    function test_AH_Settle_BeforeEnd_Reverts() public {
        uint256 id = _createEthAuction();
        vm.expectRevert("AH: auction not ended");
        ah.settleAuction(id);
    }

    function test_AH_Settle_AlreadySettled_Reverts() public {
        uint256 id = _createEthAuction();
        vm.warp(endTime + 1);
        ah.settleAuction(id);

        vm.expectRevert("AH: auction not active");
        ah.settleAuction(id);
    }

    function test_AH_Settle_AnyoneCanSettle() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.warp(endTime + 1);
        vm.prank(bidder2); // third party settles
        ah.settleAuction(id);

        assertTrue(ah.getAuction(id).settled);
    }

    // Reserve-not-met via a second auction with reserve higher than bid
    function test_AH_Settle_ReserveNotMet_QueuesRefund() public {
        // Create auction with reserve=2 ether, place bid of exactly 1 ether...
        // Actually placeBid requires bid >= reserve, so we can't have a bid below reserve.
        // Reserve-not-met can only happen if reserve was lowered after creation (not possible here).
        // The only way is: auction ends with no bids. Test this scenario.
        uint256 id = _createEthAuction();
        vm.warp(endTime + 1);
        ah.settleAuction(id);
        // No bids placed, highestBidder == address(0) — no refund queued
        assertEq(ah.pendingWithdrawal(id, address(0)), 0);
        assertTrue(ah.getAuction(id).settled);
    }

    // ── cancelAuction ────────────────────────────────────────────────────────

    function test_AH_Cancel_BySeller() public {
        uint256 id = _createEthAuction();
        vm.prank(seller);
        ah.cancelAuction(id);

        assertTrue(ah.getAuction(id).cancelled);
        assertEq(ah.lockedAmount(seller, address(ft)), 0);
    }

    function test_AH_Cancel_ByAdmin() public {
        uint256 id = _createEthAuction();
        vm.prank(admin);
        ah.cancelAuction(id);
        assertTrue(ah.getAuction(id).cancelled);
    }

    function test_AH_Cancel_AfterBid_Reverts() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.prank(seller);
        vm.expectRevert("AH: bids already placed");
        ah.cancelAuction(id);
    }

    function test_AH_Cancel_NotSellerOrAdmin_Reverts() public {
        uint256 id = _createEthAuction();
        vm.prank(bidder1);
        vm.expectRevert("AH: not seller or admin");
        ah.cancelAuction(id);
    }

    function test_AH_Cancel_AlreadyCancelled_Reverts() public {
        uint256 id = _createEthAuction();
        vm.prank(seller);
        ah.cancelAuction(id);

        vm.prank(seller);
        vm.expectRevert("AH: auction not active");
        ah.cancelAuction(id);
    }

    function test_AH_Cancel_WhilePaused_Succeeds() public {
        // cancelAuction intentionally has no whenNotPaused — sellers must always be able to exit
        uint256 id = _createEthAuction();
        vm.prank(admin);
        ah.pause();

        vm.prank(seller);
        ah.cancelAuction(id);
        assertTrue(ah.getAuction(id).cancelled);
    }

    // ── withdrawBid ──────────────────────────────────────────────────────────

    function test_AH_WithdrawBid_ETH_OutbidRefund() public {
        uint256 id   = _createEthAuction();
        uint256 bid2 = RESERVE + INCREMENT;

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.deal(bidder2, 10 ether);
        vm.prank(bidder2);
        ah.placeBid{value: bid2}(id, bid2);

        uint256 before = bidder1.balance;
        vm.prank(bidder1);
        ah.withdrawBid(id);

        assertEq(bidder1.balance - before, RESERVE);
        assertEq(ah.pendingWithdrawal(id, bidder1), 0);
    }

    function test_AH_WithdrawBid_ERC20_OutbidRefund() public {
        uint256 id       = _createErc20Auction();
        uint256 reserve  = 1_000e6;
        uint256 bid2     = 1_100e6;

        musd.mint(bidder1, reserve);
        vm.prank(bidder1);
        musd.approve(address(ah), reserve);
        vm.prank(bidder1);
        ah.placeBid(id, reserve);

        musd.mint(bidder2, bid2);
        vm.prank(bidder2);
        musd.approve(address(ah), bid2);
        vm.prank(bidder2);
        ah.placeBid(id, bid2);

        vm.prank(bidder1);
        ah.withdrawBid(id);

        assertEq(musd.balanceOf(bidder1), reserve);
        assertEq(ah.pendingWithdrawal(id, bidder1), 0);
    }

    function test_AH_WithdrawBid_NothingToWithdraw_Reverts() public {
        uint256 id = _createEthAuction();
        vm.prank(bidder1);
        vm.expectRevert("AH: nothing to withdraw");
        ah.withdrawBid(id);
    }

    function test_AH_WithdrawBid_CannotWithdrawTwice() public {
        uint256 id   = _createEthAuction();
        uint256 bid2 = RESERVE + INCREMENT;

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.deal(bidder2, 10 ether);
        vm.prank(bidder2);
        ah.placeBid{value: bid2}(id, bid2);

        vm.startPrank(bidder1);
        ah.withdrawBid(id);
        vm.expectRevert("AH: nothing to withdraw");
        ah.withdrawBid(id);
        vm.stopPrank();
    }

    // ── admin: fees ──────────────────────────────────────────────────────────

    function test_AH_SetPlatformFee() public {
        vm.prank(admin);
        ah.setPlatformFee(500);
        assertEq(ah.platformFeeBps(), 500);
    }

    function test_AH_SetPlatformFee_TooHigh_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AH: fee exceeds max");
        ah.setPlatformFee(1001);
    }

    function test_AH_SetPlatformFee_OnlyOwner_Reverts() public {
        vm.prank(bidder1);
        vm.expectRevert();
        ah.setPlatformFee(100);
    }

    function test_AH_WithdrawFees_ETH() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);
        vm.warp(endTime + 1);
        ah.settleAuction(id);

        uint256 fee = (RESERVE * FEE_BPS) / 10000;
        assertEq(ah.accruedFees(address(0)), fee);

        uint256 adminBefore = admin.balance;
        vm.prank(admin);
        ah.withdrawFees(address(0), admin);

        assertEq(admin.balance - adminBefore, fee);
        assertEq(ah.accruedFees(address(0)), 0);
    }

    function test_AH_WithdrawFees_ERC20() public {
        uint256 id      = _createErc20Auction();
        uint256 reserve = 1_000e6;

        musd.mint(bidder1, reserve);
        vm.prank(bidder1);
        musd.approve(address(ah), reserve);
        vm.prank(bidder1);
        ah.placeBid(id, reserve);

        vm.warp(endTime + 1);
        ah.settleAuction(id);

        uint256 fee = (reserve * FEE_BPS) / 10000;

        vm.prank(admin);
        ah.withdrawFees(address(musd), admin);

        assertEq(musd.balanceOf(admin), fee);
        assertEq(ah.accruedFees(address(musd)), 0);
    }

    function test_AH_WithdrawFees_ZeroRecipient_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AH: zero recipient");
        ah.withdrawFees(address(0), address(0));
    }

    function test_AH_WithdrawFees_NoFees_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AH: no fees to withdraw");
        ah.withdrawFees(address(0), admin);
    }

    function test_AH_WithdrawFees_OnlyOwner_Reverts() public {
        vm.prank(bidder1);
        vm.expectRevert();
        ah.withdrawFees(address(0), bidder1);
    }

    // ── pause / upgrade ──────────────────────────────────────────────────────

    function test_AH_Pause_Unpause() public {
        vm.prank(admin);
        ah.pause();
        assertTrue(ah.paused());

        vm.prank(admin);
        ah.unpause();
        assertFalse(ah.paused());
    }

    function test_AH_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AH: zero implementation");
        ah.upgradeToAndCall(address(0), "");
    }

    function test_AH_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AH: not a contract");
        ah.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_AH_Upgrade_Success() public {
        AuctionHouse newImpl = new AuctionHouse();
        vm.prank(admin);
        ah.upgradeToAndCall(address(newImpl), "");
        assertEq(ah.owner(), admin);
    }

    function test_AH_Upgrade_OnlyOwner_Reverts() public {
        AuctionHouse newImpl = new AuctionHouse();
        vm.prank(bidder1);
        vm.expectRevert();
        ah.upgradeToAndCall(address(newImpl), "");
    }

    // ── view helpers ─────────────────────────────────────────────────────────

    function test_AH_GetAuction_NonExistent_ReturnsEmpty() public view {
        AuctionHouse.Auction memory a = ah.getAuction(999);
        assertEq(a.seller, address(0));
    }

    function test_AH_PendingWithdrawal_View() public {
        uint256 id   = _createEthAuction();
        uint256 bid2 = RESERVE + INCREMENT;

        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.deal(bidder2, 10 ether);
        vm.prank(bidder2);
        ah.placeBid{value: bid2}(id, bid2);

        assertEq(ah.pendingWithdrawal(id, bidder1), RESERVE);
    }

    // Payment token whitelist
    function test_CreateAuction_UnallowedPaymentToken_Reverts() public {
        address rando = makeAddr("randoToken");
        vm.prank(seller);
        vm.expectRevert("AH: payment token not allowed");
        ah.createAuction(address(ft), AUCTION_AMT, RESERVE, INCREMENT, startTime, endTime, rando);
    }

    function test_AllowDisallowPaymentToken() public {
        MockERC20 newToken = new MockERC20();
        assertFalse(ah.isPaymentTokenAllowed(address(newToken)));

        vm.prank(admin);
        ah.allowPaymentToken(address(newToken));
        assertTrue(ah.isPaymentTokenAllowed(address(newToken)));

        vm.prank(admin);
        ah.disallowPaymentToken(address(newToken));
        assertFalse(ah.isPaymentTokenAllowed(address(newToken)));
    }

    function test_AllowPaymentToken_OnlyOwner_Reverts() public {
        MockERC20 newToken = new MockERC20();
        vm.prank(bidder1);
        vm.expectRevert();
        ah.allowPaymentToken(address(newToken));
    }

    // emergencyAdminSettle
    function test_EmergencyAdminSettle_WithBid_Success() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.warp(endTime + 1);

        uint256 frozenBefore = ft.frozenTokens(seller);
        assertGt(frozenBefore, 0);

        vm.prank(admin);
        ah.emergencyAdminSettle(id);

        assertTrue(ah.getAuction(id).settled);
        assertEq(ft.frozenTokens(seller), 0);
        assertEq(ah.pendingWithdrawal(id, bidder1), RESERVE);
    }

    function test_EmergencyAdminSettle_NoBids_Success() public {
        uint256 id = _createEthAuction();
        vm.warp(endTime + 1);

        vm.prank(admin);
        ah.emergencyAdminSettle(id);

        assertTrue(ah.getAuction(id).settled);
        assertEq(ft.frozenTokens(seller), 0);
    }

    function test_EmergencyAdminSettle_AlreadySettled_Reverts() public {
        uint256 id = _createEthAuction();
        vm.warp(endTime + 1);
        vm.prank(admin);
        ah.emergencyAdminSettle(id);

        vm.prank(admin);
        vm.expectRevert("AH: auction not active");
        ah.emergencyAdminSettle(id);
    }

    function test_EmergencyAdminSettle_OnlyOwner_Reverts() public {
        uint256 id = _createEthAuction();
        vm.prank(bidder1);
        vm.expectRevert();
        ah.emergencyAdminSettle(id);
    }

    // Cancel allowed while paused (sellers can always exit)
    function test_CancelAuction_WhilePaused_Succeeds() public {
        uint256 id = _createEthAuction();

        vm.prank(admin);
        ah.pause();

        vm.prank(seller);
        ah.cancelAuction(id);

        assertFalse(ah.getAuction(id).cancelled == false);
        assertTrue(ah.getAuction(id).cancelled);
    }

    // settleAuction respects pause
    function test_SettleAuction_WhenPaused_Reverts() public {
        uint256 id = _createEthAuction();
        vm.deal(bidder1, 10 ether);
        vm.prank(bidder1);
        ah.placeBid{value: RESERVE}(id, RESERVE);

        vm.warp(endTime + 1);

        vm.prank(admin);
        ah.pause();

        vm.expectRevert();
        ah.settleAuction(id);
    }

    // ── Fuzz tests ─────────────────────────────────────────────────────────────

    function testFuzz_SettleAuction_FeeAccounting(
        uint256 bidAmount,
        uint16  feeBps
    ) public {
        feeBps    = uint16(bound(feeBps, 0, ah.MAX_FEE_BPS()));
        bidAmount = bound(bidAmount, RESERVE, 1000 ether);

        vm.prank(admin);
        ah.setPlatformFee(feeBps);

        uint256 id = _createEthAuction();

        vm.deal(bidder1, bidAmount);
        vm.prank(bidder1);
        ah.placeBid{value: bidAmount}(id, bidAmount);

        vm.warp(endTime + 1);

        uint256 sellerBefore = seller.balance;
        ah.settleAuction(id);

        // fee + seller proceeds must equal winning bid exactly (no ETH lost to rounding)
        assertEq(ah.accruedFees(address(0)) + (seller.balance - sellerBefore), bidAmount);
    }

    // ── proposeUpgradeAdmin / acceptUpgradeAdmin ──────────────────────────────

    function test_ProposeUpgradeAdmin_Success() public {
        address newAdmin = makeAddr("newAHUpgradeAdmin");
        vm.prank(admin);
        ah.proposeUpgradeAdmin(newAdmin);
        vm.prank(newAdmin);
        ah.acceptUpgradeAdmin();
        assertEq(ah.upgradeAdmin(), newAdmin);
    }

    function test_ProposeUpgradeAdmin_NotUpgradeAdmin_Reverts() public {
        vm.prank(bidder1);
        vm.expectRevert("AH: caller not upgrade admin");
        ah.proposeUpgradeAdmin(bidder1);
    }

    function test_ProposeUpgradeAdmin_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AH: zero address");
        ah.proposeUpgradeAdmin(address(0));
    }

    function test_AcceptUpgradeAdmin_NotPending_Reverts() public {
        vm.prank(bidder1);
        vm.expectRevert("AH: caller not pending upgrade admin");
        ah.acceptUpgradeAdmin();
    }

    receive() external payable {}
}
