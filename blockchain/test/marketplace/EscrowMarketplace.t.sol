// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ClaimTopicsRegistry} from "../../src/compliance/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "../../src/compliance/TrustedIssuersRegistry.sol";
import {IdentityRegistry} from "../../src/compliance/IdentityRegistry.sol";
import {ComplianceModule} from "../../src/compliance/ComplianceModule.sol";
import {FractionalToken} from "../../src/tokens/FractionalToken.sol";
import {EscrowMarketplace} from "../../src/marketplace/EscrowMarketplace.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract EscrowMarketplaceTest is Test {
    ClaimTopicsRegistry    internal ctr;
    TrustedIssuersRegistry internal tir;
    IdentityRegistry       internal ir;
    ComplianceModule       internal cm;
    FractionalToken        internal ft;
    EscrowMarketplace      internal escrow;
    MockERC20              internal usdc;

    address internal admin   = makeAddr("admin");
    address internal issuer  = makeAddr("issuer");
    address internal seller  = makeAddr("seller");
    address internal buyer   = makeAddr("buyer");
    address internal stranger = makeAddr("stranger");

    bytes32 internal ASSET_ID     = keccak256("asset-001");
    uint256 internal SUPPLY       = 1_000_000e18;
    uint256 internal PRICE_PER    = 1e6;     // 1 USDC per token (6 decimals)
    uint256 internal LIST_AMOUNT  = 1000e18;
    uint16  internal FEE_BPS      = 250;     // 2.5%

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
                "Asset Token", "AT1", SUPPLY, ASSET_ID, address(ir), address(cm), admin, admin
            )
        ))));
        ft.mintInitialSupply(seller, address(0), SUPPLY, 0, 10000);

        escrow = EscrowMarketplace(payable(address(new ERC1967Proxy(
            address(new EscrowMarketplace()),
            abi.encodeWithSelector(EscrowMarketplace.initialize.selector, admin, FEE_BPS, admin)
        ))));

        // Register escrow as agent so it can freeze/unfreeze seller tokens
        ft.addAgent(address(escrow));

        vm.stopPrank();

        usdc = new MockERC20();

        // Whitelist USDC as accepted payment token
        vm.prank(admin);
        escrow.allowPaymentToken(address(usdc));

        _kyc(seller);
        _kyc(buyer);
    }

    function _kyc(address wallet) internal {
        vm.startPrank(issuer);
        ir.addIdentity(wallet, keccak256(abi.encodePacked(wallet)));
        ir.addClaim(wallet, 1, abi.encodePacked(bytes2("US")), "");
        ir.addClaim(wallet, 3, abi.encodePacked(bytes2("US")), "");
        vm.stopPrank();
    }

    function _approveAndList() internal returns (uint256 listingId) {
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT);
        listingId = escrow.listTokens(address(ft), LIST_AMOUNT, PRICE_PER, address(usdc));
        vm.stopPrank();
    }

    function _approveAndListETH() internal returns (uint256 listingId) {
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT);
        listingId = escrow.listTokens(address(ft), LIST_AMOUNT, 1e15, address(0));
        vm.stopPrank();
    }

    // Initialize
    function test_Initialize() public view {
        assertEq(escrow.owner(), admin);
        assertEq(escrow.platformFeeBps(), FEE_BPS);
        assertEq(escrow.nextListingId(), 1);
    }

    // List
    function test_List_Success() public {
        uint256 id = _approveAndList();

        assertEq(id, 1);
        EscrowMarketplace.Listing memory l = escrow.getListing(1);
        assertEq(l.seller,        seller);
        assertEq(l.tokenContract, address(ft));
        assertEq(l.amount,        LIST_AMOUNT);
        assertEq(l.pricePerToken, PRICE_PER);
        assertEq(l.paymentToken,  address(usdc));
        assertTrue(l.active);
        assertEq(escrow.getListedAmount(seller, address(ft)), LIST_AMOUNT);
    }

    function test_List_IncrementingIds() public {
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT * 2);
        uint256 id1 = escrow.listTokens(address(ft), LIST_AMOUNT / 2, PRICE_PER, address(usdc));
        uint256 id2 = escrow.listTokens(address(ft), LIST_AMOUNT / 2, PRICE_PER, address(usdc));
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(escrow.nextListingId(), 3);
    }

    function test_List_ZeroTokenContract_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("EM: zero token contract");
        escrow.listTokens(address(0), LIST_AMOUNT, PRICE_PER, address(usdc));
    }

    function test_List_ZeroAmount_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("EM: zero amount");
        escrow.listTokens(address(ft), 0, PRICE_PER, address(usdc));
    }

    function test_List_ZeroPrice_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("EM: zero price");
        escrow.listTokens(address(ft), LIST_AMOUNT, 0, address(usdc));
    }

    function test_List_InsufficientAllowance_Reverts() public {
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT - 1);
        vm.expectRevert("EM: insufficient allowance");
        escrow.listTokens(address(ft), LIST_AMOUNT, PRICE_PER, address(usdc));
        vm.stopPrank();
    }

    function test_List_InsufficientBalance_Reverts() public {
        address poorSeller = makeAddr("poor");
        _kyc(poorSeller);
        vm.prank(poorSeller);
        ft.approve(address(escrow), LIST_AMOUNT);
        vm.prank(poorSeller);
        vm.expectRevert("EM: insufficient unlisted balance");
        escrow.listTokens(address(ft), LIST_AMOUNT, PRICE_PER, address(usdc));
    }

    // Purchase ERC-20
    function test_Purchase_ERC20_Success() public {
        uint256 id = _approveAndList();
        uint256 totalPrice = LIST_AMOUNT * PRICE_PER / 1e18;
        uint256 fee        = (totalPrice * FEE_BPS) / 10000;
        uint256 proceeds   = totalPrice - fee;

        usdc.mint(buyer, totalPrice);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), totalPrice);
        escrow.purchaseListing(id, totalPrice);
        vm.stopPrank();

        assertEq(ft.balanceOf(buyer),          LIST_AMOUNT);
        assertEq(ft.balanceOf(seller),         SUPPLY - LIST_AMOUNT);
        assertEq(usdc.balanceOf(seller),       proceeds);
        assertEq(escrow.accruedFees(address(usdc)), fee);
        assertFalse(escrow.getListing(id).active);
        assertEq(escrow.getListedAmount(seller, address(ft)), 0);
    }

    function test_Purchase_ETH_Success() public {
        uint256 pricePerToken = 1e15; // 0.001 ETH per token
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT);
        uint256 id = escrow.listTokens(address(ft), LIST_AMOUNT, pricePerToken, address(0));
        vm.stopPrank();

        uint256 totalPrice = LIST_AMOUNT * pricePerToken / 1e18;
        uint256 fee        = (totalPrice * FEE_BPS) / 10000;
        uint256 proceeds   = totalPrice - fee;

        vm.deal(buyer, totalPrice);
        uint256 sellerBefore = seller.balance;

        vm.prank(buyer);
        escrow.purchaseListing{value: totalPrice}(id, totalPrice);

        assertEq(ft.balanceOf(buyer),        LIST_AMOUNT);
        assertEq(seller.balance,             sellerBefore + proceeds);
        assertEq(escrow.accruedFees(address(0)), fee);
    }

    function test_Purchase_SellerCannotBuyOwn_Reverts() public {
        uint256 id = _approveAndList();
        vm.prank(seller);
        vm.expectRevert("EM: seller cannot buy own listing");
        escrow.purchaseListing(id, type(uint256).max);
    }

    function test_Purchase_InactiveListng_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("EM: listing not active");
        escrow.purchaseListing(999, type(uint256).max);
    }

    function test_Purchase_WrongETH_Reverts() public {
        uint256 id = _approveAndListETH();
        uint256 totalPrice = LIST_AMOUNT * 1e15 / 1e18;
        vm.deal(buyer, totalPrice);
        vm.prank(buyer);
        vm.expectRevert("EM: incorrect ETH amount");
        escrow.purchaseListing{value: totalPrice - 1}(id, totalPrice);
    }

    function test_Purchase_ETH_SentToERC20Listing_Reverts() public {
        uint256 id = _approveAndList();
        uint256 totalPrice = LIST_AMOUNT * PRICE_PER / 1e18;
        usdc.mint(buyer, totalPrice);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), totalPrice);
        vm.deal(buyer, 1 ether);
        vm.expectRevert("EM: ETH not accepted for ERC-20 listing");
        escrow.purchaseListing{value: 1}(id, type(uint256).max);
        vm.stopPrank();
    }

    function test_Purchase_BuyerNotKYC_Reverts() public {
        uint256 id = _approveAndList();
        uint256 totalPrice = LIST_AMOUNT * PRICE_PER / 1e18;
        usdc.mint(stranger, totalPrice);
        vm.startPrank(stranger);
        usdc.approve(address(escrow), totalPrice);
        vm.expectRevert("CM: recipient not KYC verified");
        escrow.purchaseListing(id, type(uint256).max);
        vm.stopPrank();
    }

    // Cancel
    function test_Cancel_BySeller_Success() public {
        uint256 id = _approveAndList();
        vm.prank(seller);
        escrow.cancelListing(id);

        assertFalse(escrow.getListing(id).active);
        assertEq(escrow.getListedAmount(seller, address(ft)), 0);
    }

    function test_Cancel_ByAdmin_Success() public {
        uint256 id = _approveAndList();
        vm.prank(admin);
        escrow.cancelListing(id);
        assertFalse(escrow.getListing(id).active);
    }

    function test_Cancel_ByStranger_Reverts() public {
        uint256 id = _approveAndList();
        vm.prank(stranger);
        vm.expectRevert("EM: not seller or admin");
        escrow.cancelListing(id);
    }

    function test_Cancel_AlreadyInactive_Reverts() public {
        uint256 id = _approveAndList();
        vm.prank(seller);
        escrow.cancelListing(id);
        vm.prank(seller);
        vm.expectRevert("EM: listing not active");
        escrow.cancelListing(id);
    }

    // Update price
    function test_UpdatePrice_Success() public {
        uint256 id = _approveAndList();
        vm.prank(seller);
        escrow.updatePrice(id, PRICE_PER * 2);

        assertEq(escrow.getListing(id).pricePerToken, PRICE_PER * 2);
    }

    function test_UpdatePrice_NotSeller_Reverts() public {
        uint256 id = _approveAndList();
        vm.prank(stranger);
        vm.expectRevert("EM: not seller");
        escrow.updatePrice(id, PRICE_PER * 2);
    }

    function test_UpdatePrice_ZeroPrice_Reverts() public {
        uint256 id = _approveAndList();
        vm.prank(seller);
        vm.expectRevert("EM: zero price");
        escrow.updatePrice(id, 0);
    }

    function test_UpdatePrice_InactiveListing_Reverts() public {
        vm.prank(seller);
        vm.expectRevert("EM: listing not active");
        escrow.updatePrice(999, PRICE_PER);
    }

    // Platform fee
    function test_SetPlatformFee_Success() public {
        vm.prank(admin);
        escrow.setPlatformFee(500);
        assertEq(escrow.platformFeeBps(), 500);
    }

    function test_SetPlatformFee_ExceedsMax_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: fee exceeds max");
        escrow.setPlatformFee(1001);
    }

    function test_SetPlatformFee_OnlyOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        escrow.setPlatformFee(100);
    }

    // Withdraw fees
    function test_WithdrawFees_ERC20_Success() public {
        uint256 id = _approveAndList();
        uint256 totalPrice = LIST_AMOUNT * PRICE_PER / 1e18;
        usdc.mint(buyer, totalPrice);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), totalPrice);
        escrow.purchaseListing(id, totalPrice);
        vm.stopPrank();

        uint256 fee = (totalPrice * FEE_BPS) / 10000;
        vm.prank(admin);
        escrow.withdrawFees(address(usdc), admin);

        assertEq(usdc.balanceOf(admin), fee);
        assertEq(escrow.accruedFees(address(usdc)), 0);
    }

    function test_WithdrawFees_ETH_Success() public {
        uint256 pricePerToken = 1e15;
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT);
        uint256 id = escrow.listTokens(address(ft), LIST_AMOUNT, pricePerToken, address(0));
        vm.stopPrank();

        uint256 totalPrice = LIST_AMOUNT * pricePerToken / 1e18;
        vm.deal(buyer, totalPrice);
        vm.prank(buyer);
        escrow.purchaseListing{value: totalPrice}(id, totalPrice);

        uint256 fee = (totalPrice * FEE_BPS) / 10000;
        uint256 adminBefore = admin.balance;
        vm.prank(admin);
        escrow.withdrawFees(address(0), admin);

        assertEq(admin.balance, adminBefore + fee);
        assertEq(escrow.accruedFees(address(0)), 0);
    }

    function test_WithdrawFees_NoFees_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: no fees to withdraw");
        escrow.withdrawFees(address(usdc), admin);
    }

    function test_WithdrawFees_ZeroRecipient_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: zero recipient");
        escrow.withdrawFees(address(usdc), address(0));
    }

    // Pause
    function test_Pause_BlocksList() public {
        vm.prank(admin);
        escrow.pause();
        vm.startPrank(seller);
        ft.approve(address(escrow), LIST_AMOUNT);
        vm.expectRevert();
        escrow.listTokens(address(ft), LIST_AMOUNT, PRICE_PER, address(usdc));
        vm.stopPrank();
    }

    function test_Cancel_WhilePaused_Succeeds() public {
        uint256 id = _approveAndList();
        vm.prank(admin);
        escrow.pause();

        vm.prank(seller);
        escrow.cancelListing(id);
        assertFalse(escrow.getListing(id).active);
    }

    // Upgrade
    function test_Upgrade_Success() public {
        EscrowMarketplace newImpl = new EscrowMarketplace();
        vm.prank(admin);
        escrow.upgradeToAndCall(address(newImpl), "");
        assertEq(escrow.platformFeeBps(), FEE_BPS);
    }

    function test_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: zero implementation");
        escrow.upgradeToAndCall(address(0), "");
    }

    function test_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: not a contract");
        escrow.upgradeToAndCall(makeAddr("eoa"), "");
    }

    // Double-listing prevention
    function test_List_DoubleListing_ExceedsBalance_Reverts() public {
        vm.startPrank(seller);
        ft.approve(address(escrow), SUPPLY + 1);
        escrow.listTokens(address(ft), SUPPLY, PRICE_PER, address(usdc));
        vm.expectRevert("EM: insufficient unlisted balance");
        escrow.listTokens(address(ft), 1, PRICE_PER, address(usdc));
        vm.stopPrank();
    }

    // Payment token whitelist
    function test_List_UnallowedPaymentToken_Reverts() public {
        address rando = makeAddr("randoToken");
        vm.prank(seller);
        ft.approve(address(escrow), LIST_AMOUNT);
        vm.prank(seller);
        vm.expectRevert("EM: payment token not allowed");
        escrow.listTokens(address(ft), LIST_AMOUNT, PRICE_PER, rando);
    }

    function test_AllowDisallowPaymentToken() public {
        MockERC20 newToken = new MockERC20();
        assertFalse(escrow.isPaymentTokenAllowed(address(newToken)));

        vm.prank(admin);
        escrow.allowPaymentToken(address(newToken));
        assertTrue(escrow.isPaymentTokenAllowed(address(newToken)));

        vm.prank(admin);
        escrow.disallowPaymentToken(address(newToken));
        assertFalse(escrow.isPaymentTokenAllowed(address(newToken)));
    }

    function test_AllowPaymentToken_OnlyOwner_Reverts() public {
        MockERC20 newToken = new MockERC20();
        vm.prank(stranger);
        vm.expectRevert();
        escrow.allowPaymentToken(address(newToken));
    }

    // Slippage protection
    function test_Purchase_PriceExceedsMax_Reverts() public {
        uint256 id = _approveAndList();
        uint256 totalPrice = LIST_AMOUNT * PRICE_PER / 1e18;
        usdc.mint(buyer, totalPrice);
        vm.startPrank(buyer);
        usdc.approve(address(escrow), totalPrice);
        vm.expectRevert("EM: price exceeds max");
        escrow.purchaseListing(id, totalPrice - 1);
        vm.stopPrank();
    }

    // Emergency admin cancel
    function test_EmergencyAdminCancel_Success() public {
        uint256 id = _approveAndList();
        uint256 frozenBefore = ft.frozenTokens(seller);
        assertEq(frozenBefore, LIST_AMOUNT);

        vm.prank(admin);
        escrow.emergencyAdminCancel(id);

        assertFalse(escrow.getListing(id).active);
        assertEq(ft.frozenTokens(seller), 0);
    }

    function test_EmergencyAdminCancel_OnlyOwner_Reverts() public {
        uint256 id = _approveAndList();
        vm.prank(stranger);
        vm.expectRevert();
        escrow.emergencyAdminCancel(id);
    }

    function test_EmergencyAdminCancel_InactiveListing_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: listing not active");
        escrow.emergencyAdminCancel(999);
    }

    // ── Fuzz tests ─────────────────────────────────────────────────────────────

    function testFuzz_PurchaseListing_FeeAccounting(
        uint256 amount,
        uint256 pricePerToken,
        uint16  feeBps
    ) public {
        feeBps        = uint16(bound(feeBps, 0, escrow.MAX_FEE_BPS()));
        amount        = bound(amount, 1e18, SUPPLY);
        pricePerToken = bound(pricePerToken, 1, 1e12);

        uint256 totalPrice = amount * pricePerToken / 1e18;
        vm.assume(totalPrice > 0);

        vm.prank(admin);
        escrow.setPlatformFee(feeBps);

        usdc.mint(buyer, totalPrice);

        vm.startPrank(seller);
        ft.approve(address(escrow), amount);
        uint256 listingId = escrow.listTokens(address(ft), amount, pricePerToken, address(usdc));
        vm.stopPrank();

        vm.startPrank(buyer);
        usdc.approve(address(escrow), totalPrice);
        escrow.purchaseListing(listingId, totalPrice);
        vm.stopPrank();

        // fee + seller proceeds must equal total price exactly (no value lost to rounding)
        assertEq(escrow.accruedFees(address(usdc)) + usdc.balanceOf(seller), totalPrice);
    }

    // ── proposeUpgradeAdmin / acceptUpgradeAdmin ──────────────────────────────

    function test_ProposeUpgradeAdmin_Success() public {
        address newAdmin = makeAddr("newEMUpgradeAdmin");
        vm.prank(admin);
        escrow.proposeUpgradeAdmin(newAdmin);
        vm.prank(newAdmin);
        escrow.acceptUpgradeAdmin();
        assertEq(escrow.upgradeAdmin(), newAdmin);
    }

    function test_ProposeUpgradeAdmin_NotUpgradeAdmin_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("EM: caller not upgrade admin");
        escrow.proposeUpgradeAdmin(buyer);
    }

    function test_ProposeUpgradeAdmin_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("EM: zero address");
        escrow.proposeUpgradeAdmin(address(0));
    }

    function test_AcceptUpgradeAdmin_NotPending_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("EM: caller not pending upgrade admin");
        escrow.acceptUpgradeAdmin();
    }
}
