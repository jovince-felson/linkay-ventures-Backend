// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title AssetNFT
 * @notice ERC-721 representing the on-chain identity of a single real-world asset.
 *         One token is minted per asset; the IPFS metadata URI is immutable post-mint.
 *         Transfers are restricted to the platform admin  -  this is not a freely tradeable NFT.
 * @dev Uses OwnableUpgradeable (not Ownable2Step) so the factory can atomically call
 *      mint() then transferOwnership() in one transaction.
 */
contract AssetNFT is
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public assetId;          // keccak256 of platform UUID
    uint256 public tokenId;          // assigned at mint (incrementing, managed by factory)
    string  private _metadataURI;
    bool    public  minted;

    event AssetNFTMinted(uint256 indexed tokenId, bytes32 indexed assetId, address owner, string metadataURI);
    event ContractUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        bytes32 _assetId,
        address admin
    ) external initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(admin);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        assetId = _assetId;
    }

    //  Mint (one-time, onlyOwner) 

    // One-time mint. Reverts if already minted.
    function mint(address to, uint256 _tokenId, string calldata metadataURI)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        require(!minted, "AssetNFT: already minted");
        require(to != address(0), "AssetNFT: zero address");
        require(bytes(metadataURI).length > 0, "AssetNFT: empty metadata URI");

        tokenId      = _tokenId;
        _metadataURI = metadataURI;
        minted       = true;

        _safeMint(to, _tokenId);
        emit AssetNFTMinted(_tokenId, assetId, to, metadataURI);
    }

    // Transfer lock
    // Asset NFTs represent real-world asset identity  -  only the admin may transfer them.
    function transferFrom(address from, address to, uint256 id) public override whenNotPaused {
        require(msg.sender == owner(), "AssetNFT: transfers restricted to admin");
        super.transferFrom(from, to, id);
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes memory data)
        public
        override
        whenNotPaused
    {
        require(msg.sender == owner(), "AssetNFT: transfers restricted to admin");
        super.safeTransferFrom(from, to, id, data);
    }

    // Metadata
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_tokenId == tokenId && minted, "AssetNFT: token not found");
        return _metadataURI;
    }

    // Pause / upgrade
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "AssetNFT: zero implementation");
        require(newImplementation.code.length > 0, "AssetNFT: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("AssetNFT: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[50] private __gap;
}
