// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {FractionalToken} from "../tokens/FractionalToken.sol";

/**
 * @title FractionalTokenFactory
 * @notice Deploys one FractionalToken proxy per asset, wired to the shared
 *         IdentityRegistry and ComplianceModule. Records each deployment by assetId.
 * @dev UUPS upgradeable. Ownable2Step prevents accidental ownership transfer.
 */
contract FractionalTokenFactory is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable
{
    address public implementation;
    address public identityRegistry;
    address public complianceModule;

    // assetId => deployed token proxy address
    mapping(bytes32 => address) public deployedToken;
    address[] private _allDeployments;

    event FractionalTokenDeployed(
        bytes32 indexed assetId,
        address indexed tokenContract,
        string  name,
        string  symbol,
        uint256 totalSupply,
        uint16  tokenizeBps
    );
    event ImplementationUpdated(address indexed newImplementation);
    event ContractUpgraded(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address _implementation,
        address _identityRegistry,
        address _complianceModule
    ) external initializer {
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        require(_implementation    != address(0), "FTFAC: zero implementation");
        require(_identityRegistry  != address(0), "FTFAC: zero IR");
        require(_complianceModule  != address(0), "FTFAC: zero CM");

        implementation    = _implementation;
        identityRegistry  = _identityRegistry;
        complianceModule  = _complianceModule;
    }

    // Deploy
    /**
     * @param name             Token name
     * @param symbol           Token symbol
     * @param totalSupply      Total token supply to mint
     * @param assetId          keccak256(abi.encodePacked(platformUUID))
     * @param treasuryWallet   Receives the publicly tokenized portion (for marketplace sale)
     * @param assetOwnerWallet Receives the retained portion. Ignored when tokenizeBps == 10000.
     * @param tokenizeBps      Basis points to tokenize publicly (1-10000). e.g. 4000 = 40%.
     */
    function deployFractionalToken(
        string  calldata name,
        string  calldata symbol,
        uint256 totalSupply,
        bytes32 assetId,
        address treasuryWallet,
        address assetOwnerWallet,
        uint16  tokenizeBps
    ) external onlyOwner whenNotPaused returns (address tokenContract) {
        require(bytes(name).length   > 0,             "FTFAC: empty name");
        require(bytes(symbol).length > 0,             "FTFAC: empty symbol");
        require(totalSupply          > 0,             "FTFAC: zero supply");
        require(assetId              != bytes32(0),   "FTFAC: empty assetId");
        require(treasuryWallet       != address(0),   "FTFAC: zero treasury");
        require(deployedToken[assetId] == address(0), "FTFAC: token already deployed");
        require(tokenizeBps >= 1 && tokenizeBps <= 10000, "FTFAC: invalid tokenize bps");
        if (tokenizeBps < 10000) {
            require(assetOwnerWallet != address(0), "FTFAC: zero asset owner");
        }

        uint256 publicAmount   = (totalSupply * tokenizeBps) / 10000;
        uint256 retainedAmount = totalSupply - publicAmount;

        bytes memory initData = abi.encodeWithSelector(
            FractionalToken.initialize.selector,
            name,
            symbol,
            totalSupply,
            assetId,
            identityRegistry,
            complianceModule,
            address(this)
        );

        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        tokenContract = address(proxy);

        FractionalToken(payable(tokenContract)).mintInitialSupply(
            treasuryWallet,
            assetOwnerWallet,
            publicAmount,
            retainedAmount,
            tokenizeBps
        );

        FractionalToken(payable(tokenContract)).transferOwnership(owner());

        deployedToken[assetId] = tokenContract;
        _allDeployments.push(tokenContract);

        emit FractionalTokenDeployed(assetId, tokenContract, name, symbol, totalSupply, tokenizeBps);
    }

    // Implementation update
    function setImplementation(address newImpl) external onlyOwner {
        require(newImpl != address(0), "FTFAC: zero implementation");
        implementation = newImpl;
        emit ImplementationUpdated(newImpl);
    }

    // View
    function getAllDeployments() external view returns (address[] memory) {
        return _allDeployments;
    }

    // Pause / upgrade
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "FTFAC: zero implementation");
        require(newImplementation.code.length > 0, "FTFAC: not a contract");
        emit ContractUpgraded(newImplementation);
    }

    // ETH rejection
    receive() external payable {
        revert("FTFAC: no ETH accepted");
    }

    // Storage gap for upgrades
    uint256[50] private __gap;
}
