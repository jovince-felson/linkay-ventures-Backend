// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AssetNFT} from "../../src/tokens/AssetNFT.sol";

contract AssetNFTTest is Test {
    AssetNFT internal nft;

    address internal admin    = makeAddr("admin");
    address internal nftOwner = makeAddr("nftOwner");
    address internal user     = makeAddr("user");

    bytes32 internal assetId = keccak256("asset-uuid-001");
    string  internal NAME    = "LinkBlock Asset #1";
    string  internal SYMBOL  = "LBA1";
    string  internal URI     = "ipfs://QmTest/metadata.json";

    function setUp() public {
        vm.startPrank(admin);
        AssetNFT impl = new AssetNFT();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(AssetNFT.initialize.selector, NAME, SYMBOL, assetId, admin)
        );
        nft = AssetNFT(payable(address(proxy)));
        vm.stopPrank();
    }

    // Initialize
    function test_Initialize() public view {
        assertEq(nft.name(), NAME);
        assertEq(nft.symbol(), SYMBOL);
        assertEq(nft.assetId(), assetId);
        assertFalse(nft.minted());
        assertEq(nft.owner(), admin);
    }

    // Mint
    function test_Mint_Success() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);

        assertTrue(nft.minted());
        assertEq(nft.tokenId(), 1);
        assertEq(nft.ownerOf(1), nftOwner);
        assertEq(nft.tokenURI(1), URI);
    }

    function test_Mint_AlreadyMinted_Reverts() public {
        vm.startPrank(admin);
        nft.mint(nftOwner, 1, URI);
        vm.expectRevert("AssetNFT: already minted");
        nft.mint(nftOwner, 2, URI);
        vm.stopPrank();
    }

    function test_Mint_ZeroAddress_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AssetNFT: zero address");
        nft.mint(address(0), 1, URI);
    }

    function test_Mint_EmptyURI_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AssetNFT: empty metadata URI");
        nft.mint(nftOwner, 1, "");
    }

    function test_Mint_OnlyOwner_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        nft.mint(nftOwner, 1, URI);
    }

    // tokenURI
    function test_TokenURI_BeforeMint_Reverts() public {
        vm.expectRevert("AssetNFT: token not found");
        nft.tokenURI(1);
    }

    function test_TokenURI_WrongId_Reverts() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);
        vm.expectRevert("AssetNFT: token not found");
        nft.tokenURI(99);
    }

    // Transfer lock
    function test_TransferFrom_AdminCanTransfer() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);

        vm.prank(nftOwner);
        nft.approve(admin, 1);

        vm.prank(admin);
        nft.transferFrom(nftOwner, user, 1);

        assertEq(nft.ownerOf(1), user);
    }

    function test_TransferFrom_NonAdmin_Reverts() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);

        vm.prank(nftOwner);
        vm.expectRevert("AssetNFT: transfers restricted to admin");
        nft.transferFrom(nftOwner, user, 1);
    }

    function test_SafeTransferFrom_AdminCanTransfer() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);

        vm.prank(nftOwner);
        nft.approve(admin, 1);

        vm.prank(admin);
        nft.safeTransferFrom(nftOwner, user, 1, "");

        assertEq(nft.ownerOf(1), user);
    }

    function test_SafeTransferFrom_NonAdmin_Reverts() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);

        vm.prank(nftOwner);
        vm.expectRevert("AssetNFT: transfers restricted to admin");
        nft.safeTransferFrom(nftOwner, user, 1, "");
    }

    // Pause / unpause
    function test_Pause_BlocksMint() public {
        vm.prank(admin);
        nft.pause();

        vm.prank(admin);
        vm.expectRevert();
        nft.mint(nftOwner, 1, URI);
    }

    function test_Unpause_AllowsMint() public {
        vm.startPrank(admin);
        nft.pause();
        nft.unpause();
        nft.mint(nftOwner, 1, URI);
        vm.stopPrank();
        assertTrue(nft.minted());
    }

    function test_Pause_BlocksTransfer() public {
        vm.prank(admin);
        nft.mint(nftOwner, 1, URI);

        vm.prank(nftOwner);
        nft.approve(admin, 1);

        vm.prank(admin);
        nft.pause();

        vm.prank(admin);
        vm.expectRevert();
        nft.transferFrom(nftOwner, user, 1);
    }

    function test_OnlyOwner_Pause_Reverts() public {
        vm.prank(user);
        vm.expectRevert();
        nft.pause();
    }

    function test_OnlyOwner_Unpause_Reverts() public {
        vm.prank(admin);
        nft.pause();

        vm.prank(user);
        vm.expectRevert();
        nft.unpause();
    }

    // ETH rejection
    function test_ReceivesETH_Reverts() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(nft).call{value: 1 ether}("");
        assertFalse(success);
    }

    // _authorizeUpgrade hardening
    function test_Upgrade_ZeroImpl_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AssetNFT: zero implementation");
        nft.upgradeToAndCall(address(0), "");
    }

    function test_Upgrade_NotContract_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("AssetNFT: not a contract");
        nft.upgradeToAndCall(makeAddr("eoa"), "");
    }

    function test_Upgrade_Success() public {
        AssetNFT newImpl = new AssetNFT();
        vm.prank(admin);
        nft.upgradeToAndCall(address(newImpl), "");
        assertEq(nft.assetId(), assetId);
    }
}
