// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AssetNFT} from "../tokens/AssetNFT.sol";

/**
 * @title AssetNFTFactory
 * @notice Deploys one AssetNFT proxy per real-world asset and records its address by assetId.
 *         All proxies share a single implementation, keeping per-asset deploy cost low.
 * @dev UUPS upgradeable. Ownable2Step prevents accidental ownership transfer.
 */
contract AssetNFTFactory is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    address public implementation;
    uint256 private _nextTokenId;

    // assetId => deployed proxy address
    mapping(bytes32 => address) public deployedNFT;
    // track all deployed addresses
    address[] private _allDeployments;

    event AssetNFTDeployed(
        bytes32 indexed assetId,
        address indexed nftContract,
        address indexed owner,
        uint256 tokenId
    );
    event ImplementationUpdated(address indexed newImplementation);
    event ContractUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    address public upgradeAdmin;
    address public pendingUpgradeAdmin;

    event UpgradeAdminTransferred(address indexed previous, address indexed next);
    event UpgradeAdminProposed(address indexed proposed);

    function initialize(address admin, address _implementation, address _upgradeAdmin) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        require(_implementation != address(0), "ANFTF: zero implementation");
        require(_upgradeAdmin   != address(0), "ANFTF: zero upgrade admin");
        implementation = _implementation;
        _nextTokenId   = 1;
        upgradeAdmin   = _upgradeAdmin;
    }

    function proposeUpgradeAdmin(address newAdmin) external {
        require(msg.sender == upgradeAdmin, "ANFTF: caller not upgrade admin");
        require(newAdmin != address(0), "ANFTF: zero address");
        pendingUpgradeAdmin = newAdmin;
        emit UpgradeAdminProposed(newAdmin);
    }

    function acceptUpgradeAdmin() external {
        require(msg.sender == pendingUpgradeAdmin, "ANFTF: caller not pending upgrade admin");
        emit UpgradeAdminTransferred(upgradeAdmin, msg.sender);
        upgradeAdmin = msg.sender;
        pendingUpgradeAdmin = address(0);
    }

    // Deploy
    /**
     * @param assetId     keccak256(abi.encodePacked(platformUUID))
     * @param metadataURI IPFS URI for the asset metadata
     * @param nftOwner    Wallet that receives the minted NFT
     */
    function deployAssetNFT(
        bytes32 assetId,
        string calldata metadataURI,
        address nftOwner
    ) external onlyOwner whenNotPaused returns (uint256 tokenId, address nftContract) {
        require(assetId != bytes32(0), "ANFTF: empty assetId");
        require(bytes(metadataURI).length > 0, "ANFTF: empty metadata URI");
        require(nftOwner != address(0), "ANFTF: zero owner");
        require(deployedNFT[assetId] == address(0), "ANFTF: asset already tokenized");

        tokenId = _nextTokenId++;

        // Build the name/symbol from assetId for on-chain readability
        string memory name   = string(abi.encodePacked("LinkBlock Asset #", _toString(tokenId)));
        string memory symbol = string(abi.encodePacked("LBA", _toString(tokenId)));

        bytes memory initData = abi.encodeWithSelector(
            AssetNFT.initialize.selector,
            name,
            symbol,
            assetId,
            address(this), // factory is initial owner; transfers ownership below
            upgradeAdmin   // timelock governs upgrades of each deployed AssetNFT
        );

        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        nftContract = address(proxy);

        // Mint the token to nftOwner
        AssetNFT(payable(nftContract)).mint(nftOwner, tokenId, metadataURI);

        // Transfer NFT contract ownership to the platform admin (factory owner)
        // so the admin can pause/upgrade but not the factory contract itself
        AssetNFT(payable(nftContract)).transferOwnership(owner());

        deployedNFT[assetId] = nftContract;
        _allDeployments.push(nftContract);

        emit AssetNFTDeployed(assetId, nftContract, nftOwner, tokenId);
    }

    //  Implementation update (for upgrades of future AssetNFT deployments) 

    function setImplementation(address newImpl) external onlyOwner {
        require(newImpl != address(0), "ANFTF: zero implementation");
        require(newImpl.code.length > 0, "ANFTF: not a contract");
        implementation = newImpl;
        emit ImplementationUpdated(newImpl);
    }

    // View
    function getAllDeployments() external view returns (address[] memory) {
        return _allDeployments;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // Pause / upgrade
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == upgradeAdmin, "ANFTF: caller not upgrade admin");
        require(newImplementation != address(0), "ANFTF: zero implementation");
        require(newImplementation.code.length > 0, "ANFTF: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("ANFTF: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[48] private __gap;

    // Helpers
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
