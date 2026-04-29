# Linkay — Tokenization Service (Module 4)

Microservice implementing the full async tokenization pipeline from the UJD Module 4.

---

## Folder Structure

```
tokenization-service/
├── .env
├── .sequelizerc
├── Dockerfile
├── index.js                          ← Entry point (port 4005)
├── package.json
├── SHARED_UTILS_UPDATES.js           ← Constants/keys to add to linkay-shared-utils
├── Linkay_Tokenization_Service.postman_collection.json
├── scripts/
│   └── db_init.js                    ← Run once to create tables
└── src/
    ├── config/
    │   ├── database.js               ← Sequelize + MySQL
    │   └── services.js               ← Inter-service URLs, blockchain config
    ├── controllers/
    │   └── tokenization.controller.js
    ├── events/
    │   └── tokenization.events.js    ← Kafka listeners
    ├── jobs/
    │   └── tokenization.processor.js ← Bull job processor (5 async steps)
    ├── middlewares/
    │   └── auth.js                   ← JWT + role verification
    ├── migrations/
    │   └── 20250429000001-tokenization-tables.js
    ├── models/
    │   ├── index.js
    │   ├── tokenization.job.model.js
    │   ├── compliance.rule.model.js
    │   └── audit.log.model.js
    ├── queues/
    │   └── tokenization.queue.js     ← Bull queue (Redis-backed)
    ├── routes/
    │   └── v1/
    │       └── tokenization.routes.js
    └── utils/
        ├── audit.helper.js
        ├── blockchain.service.js     ← ethers.js — NFT mint, ERC-3643 deploy
        └── ipfs.service.js           ← Pinata IPFS upload + metadata builder
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy .env and fill in your values
cp .env .env.local

# 3. Create MySQL database
mysql -u root -e "CREATE DATABASE linkay_tokenization_service;"

# 4. Run DB init (creates all tables)
node scripts/db_init.js

# 5. Start service
npm run dev
```

---

## Postman URLs (Base: http://localhost:4005)

| # | Method | URL | Auth | Description |
|---|--------|-----|------|-------------|
| 1 | GET | `/health` | None | Health check |
| 2 | POST | `/api/v1/tokenization/initiate` | MUSEUM_ADMIN / SUPER_ADMIN | Initiate tokenization |
| 3 | GET | `/api/v1/tokenization/status/:jobId` | Any JWT | Poll job progress |
| 4 | GET | `/api/v1/tokenization/:assetId` | Any JWT | Get result by asset |
| 5 | POST | `/api/v1/tokenization/:assetId/compliance` | SUPER_ADMIN / COMPLIANCE_OFFICER | Update compliance rules |
| 6 | GET | `/api/v1/tokenization/jobs` | SUPER_ADMIN | List all jobs |
| 7 | POST | `/api/v1/tokenization/jobs/:jobId/retry` | SUPER_ADMIN | Retry failed job |

---

## Tokenization Job — 5 Async Steps

```
QUEUED
  │
  ▼
Step 1: Upload metadata JSON → IPFS (Pinata)
  │
  ▼
Step 2: Mint ERC-721 NFT (AssetNFTFactory contract)
  │
  ▼
Step 3: Deploy ERC-3643 fractional token contract
  │
  ▼
Step 4: Attach compliance rules (jurisdictions, lock-up)
  │
  ▼
Step 5: Issue fractions to platform treasury wallet
  │
  ▼
COMPLETED → Notify Asset Service → Publish Kafka event
```

Each step is **idempotent** — if the job fails mid-way and is retried, it resumes from the last successful step. No double-minting.

---

## linkay-shared-utils Functions Used

| Function | From | Purpose |
|----------|------|---------|
| `logger` | `utils/logger.js` | Winston structured logging |
| `RESPONSE_CODES` | `constants/constant.js` | Standardised API response codes |
| `publish()` | `kafka/producer.js` | Publish Kafka events (tokenization-complete, etc.) |
| `listenToEvent()` | `kafka/eventlistener.js` | Subscribe to EKYC + tokenization events |
| `Topics` | `kafka/topics.js` | Kafka topic names |
| `Keys` | `kafka/topics.js` | Kafka message keys |

### Updates needed in linkay-shared-utils

See `SHARED_UTILS_UPDATES.js` for the exact additions:
- Add `TOKENIZATION_EVENTS` and `ASSET_EVENTS` to `Topics`
- Add `TOKENIZATION_COMPLETE`, `TOKENIZATION_FAILED`, etc. to `Keys`
- Add `tokenization_service` and `asset_service` to `SERVICE_URLS` and `BASE_URLS`
- Add roles 3–7 to `ROLES` (MUSEUM_ADMIN, SUPER_ADMIN, COMPLIANCE_OFFICER, CMS_EDITOR, INVESTOR)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (4005) |
| `DB_*` | MySQL connection |
| `JWT_SECRET` | Shared JWT secret (same across all services) |
| `KAFKA_BROKERS` | Kafka broker addresses |
| `PINATA_API_KEY / SECRET` | IPFS pinning via Pinata |
| `BLOCKCHAIN_RPC_URL` | Polygon/Ethereum RPC |
| `PLATFORM_WALLET_PRIVATE_KEY` | Platform signer wallet |
| `NFT_FACTORY_ADDRESS` | Deployed AssetNFTFactory contract |
| `FRACTIONAL_TOKEN_FACTORY_ADDRESS` | Deployed FractionalTokenFactory contract |
| `IDENTITY_REGISTRY_ADDRESS` | ERC-3643 Identity Registry |
| `COMPLIANCE_MODULE_ADDRESS` | Compliance module contract |
| `REDIS_HOST / PORT` | Redis for Bull queue |

---

## Error Codes (from UJD)

| Code | HTTP | Scenario |
|------|------|----------|
| TOK_001 | 409 | Asset already tokenized |
| TOK_002 | 400 | Asset not LIVE |
| TOK_003 | 500 | IPFS pin failed |
| TOK_004 | 500 | NFT mint failed |
| TOK_005 | 500 | ERC-3643 deploy failed |
| TOK_006 | 400 | Fraction price mismatch |
