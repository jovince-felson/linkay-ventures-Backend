# LinkBlock — Blockchain Layer

ERC-3643 compliant smart contracts for the LinkBlock real-world asset tokenization platform. Built with Foundry + Solidity 0.8.28.

## Overview

Each tokenized real-world asset gets two on-chain contracts:

- **AssetNFT** — ERC-721 that anchors the asset's identity and IPFS metadata URI on-chain. Minted once, transfer-restricted to the platform admin.
- **FractionalToken** — ERC-20 (ERC-3643/T-REX) representing investor ownership shares. Every transfer is gated by the compliance stack at the contract level — unverified wallets cannot receive tokens regardless of backend state.

Both are deployed via factory contracts using the UUPS proxy pattern. Platform-level contracts are deployed once and can be upgraded in place; per-asset contracts share a single implementation to keep deployment gas low (~200k vs ~1.5M for a full deploy).

## Contract layout

```
src/
├── compliance/
│   ├── ClaimTopicsRegistry.sol     # defines required KYC topics (1=KYC, 2=ACCREDITED, 3=JURISDICTION)
│   ├── TrustedIssuersRegistry.sol  # tracks approved claim signers (e.g. Sumsub backend wallet)
│   ├── IdentityRegistry.sol        # wallet → verified identity + compliance claims
│   └── ComplianceModule.sol        # transfer gate: KYC checks, jurisdiction rules, lock-ups
├── tokens/
│   ├── AssetNFT.sol                # ERC-721 per-asset identity token
│   └── FractionalToken.sol         # ERC-20 (ERC-3643) fractional ownership token
└── factories/
    ├── AssetNFTFactory.sol         # deploys AssetNFT proxies on tokenization
    └── FractionalTokenFactory.sol  # deploys FractionalToken proxies on tokenization
```

## How a transfer works

```
investor.transfer(to, amount)
  └── FractionalToken._update()
        └── ComplianceModule.isTransferValid()
              ├── IdentityRegistry.isVerified(from)   # sender KYC check
              ├── IdentityRegistry.isVerified(to)     # recipient KYC check
              ├── _lockUps[tokenContract][from]       # lock-up period check
              └── _assetRules[assetId].jurisdictions  # jurisdiction whitelist check
```

## Requirements

- [Foundry](https://getfoundry.sh/)

```sh
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

## Setup

```sh
git submodule update --init --recursive
```

## Build & test

```sh
forge build
forge test
forge coverage --no-match-path "script/**"
```

## Deploy

Copy `.env.example` to `.env` and fill in the required values:

```sh
cp .env.example .env
```

```sh
# Sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify

# Polygon Amoy
forge script script/Deploy.s.sol --rpc-url $AMOY_RPC_URL --broadcast --verify
```

Deployed addresses are written to `deployments/<network>.json` after each run.

## Architecture notes

**Proxy pattern** — All contracts are UUPS proxies (ERC-1967). The implementation address lives in a dedicated storage slot and can be updated via `upgradeToAndCall`, which is restricted to the platform admin (Gnosis Safe multisig). Storage gaps (`uint256[50] private __gap`) are reserved in every contract to avoid slot collisions on upgrade.

**Ownable2Step** — Platform-level contracts (compliance stack + factories) use `Ownable2StepUpgradeable`. Ownership transfers require explicit acceptance by the new owner, preventing accidental transfers to wrong addresses. Per-asset contracts (AssetNFT, FractionalToken) use single-step ownership so factories can atomically mint and hand off ownership in one transaction.

**ERC-3643 compliance** — `FractionalToken` overrides `_update` (the EVM-level transfer hook in OZ ERC-20 v5) to call `ComplianceModule.isTransferValid` on every token movement. This cannot be bypassed — any transfer from or to an unverified wallet reverts at the contract level.
