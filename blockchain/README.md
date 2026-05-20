# LinkBlock — Blockchain Layer

Smart contracts for the LinkBlock real-world asset tokenization platform. Built with Foundry and Solidity 0.8.28. Implements ERC-3643 (T-REX) compliant fractional ownership with on-chain KYC enforcement.

## Contract layout

```
src/
├── compliance/
│   ├── ClaimTopicsRegistry.sol      # required KYC claim topics (1=KYC_VERIFIED, 3=JURISDICTION)
│   ├── TrustedIssuersRegistry.sol   # approved KYC claim signers (Sumsub backend wallet)
│   ├── IdentityRegistry.sol         # wallet → identity hash + compliance claims
│   └── ComplianceModule.sol         # transfer gate: KYC, jurisdiction, lock-up checks
├── tokens/
│   ├── AssetNFT.sol                 # ERC-721 anchoring asset identity and IPFS metadata URI
│   └── FractionalToken.sol          # ERC-20 (ERC-3643) fractional ownership token
├── factories/
│   ├── AssetNFTFactory.sol          # deploys one AssetNFT proxy per asset
│   └── FractionalTokenFactory.sol   # deploys one FractionalToken proxy per asset
├── marketplace/
│   └── EscrowMarketplace.sol        # fixed-price secondary market for fractional tokens
├── auction/
│   └── AuctionHouse.sol             # English auction for fractional tokens
└── governance/
    └── GovernanceTimelock.sol       # 48h upgrade delay guard (OZ TimelockController)
```

## How compliance works

Every `FractionalToken` transfer calls the compliance stack before completing:

```
transfer(to, amount)
  └── FractionalToken._update()
        └── ComplianceModule.isTransferValid()
              ├── IdentityRegistry.isVerified(from)
              ├── IdentityRegistry.isVerified(to)
              ├── lock-up period check
              └── jurisdiction whitelist check
```

Transfers from/to unverified wallets revert at the EVM level — no backend override is possible.

## Marketplace and auction: agent registration

Both `EscrowMarketplace` and `AuctionHouse` freeze seller tokens (via `FractionalToken.freezeTokens`) when a listing or auction is created. This prevents the same tokens being committed to multiple venues simultaneously. For this to work, each contract must be registered as an agent on the relevant `FractionalToken`:

```solidity
FractionalToken(tokenAddress).addAgent(address(escrowMarketplace));
FractionalToken(tokenAddress).addAgent(address(auctionHouse));
```

This is done once per asset token, after deployment.

## Upgrade pattern

All contracts are UUPS proxies. Upgrades to platform-level contracts must go through `GovernanceTimelock` (48h minimum delay). The timelock is the only address allowed to call `upgradeToAndCall` on itself — upgrades must be queued via `schedule`, waited out, then executed.

Per-asset contracts (AssetNFT, FractionalToken) are upgraded by the platform admin directly since each asset has its own proxy.

## Setup

```sh
git submodule update --init --recursive
```

## Build and test

```sh
forge build
forge test -v
forge coverage
```

## Deploy

```sh
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY, PLATFORM_ADMIN, TRUSTED_ISSUER_WALLET

# Polygon Amoy testnet
forge script script/Deploy.s.sol --rpc-url $AMOY_RPC_URL --broadcast --verify

# Polygon mainnet
forge script script/Deploy.s.sol --rpc-url $POLYGON_RPC_URL --broadcast --verify
```

Deployed addresses are written to `deployments/<network>.json`.

After deployment, register `EscrowMarketplace` and `AuctionHouse` as agents on each `FractionalToken` before going live.

## Security notes

- `Ownable2StepUpgradeable` on all platform contracts — ownership transfer requires explicit acceptance
- `ReentrancyGuardUpgradeable` on all payment functions
- `SafeERC20` for all ERC-20 interactions
- CEI (checks-effects-interactions) pattern throughout
- `_disableInitializers()` in every implementation constructor
- Platform fee hard-capped at 10% (`MAX_FEE_BPS = 1000`)
