# Linkey Microservices — Auth Service & API Gateway

Multi-RWA Tokenization Platform | Linkay Ventures Inc / Linkay Technologies Inc

---

## Architecture Overview

```
Client → API Gateway (:3000) → Auth Service (:3001) → MySQL
```

| Service | Port | Responsibility |
|---|---|---|
| `api-gateway` | 3000 | Single entry point, reverse proxy, global rate limiting |
| `auth-services` | 3001 | JWT auth, wallet binding, KYC status, session management |
| `mysql` | 3306 | Persistent storage (via Docker) |

---

## Quick Start — Docker (Recommended)

### 1. Clone / extract the project

```bash
cd linkeymicroservices
```

### 2. Configure environment variables

Copy the example files and fill in your values **before** starting:

```bash
cp services/auth-services/.env.example services/auth-services/.env
cp services/api-gateway/.env.example   services/api-gateway/.env
```

Key values to change:

| Variable | Notes |
|---|---|
| `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` | Set in `auth-services/.env` — also read by the mysql container |
| `JWT_SECRET` | Must be **identical** in both `.env` files. Min 32 chars. |
| `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials (e.g. SendGrid) |
| `FRONTEND_URL` | Your frontend origin for CORS and email links |

### 3. Start all services

```bash
docker-compose up --build
```

Services start in order: MySQL → Auth Service → API Gateway.

### 4. Verify

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

---

## Quick Start — Local (without Docker)

### Prerequisites

- Node.js 20+
- MySQL 8.0 running locally
- Create database: `CREATE DATABASE linkey_auth;`

### Install dependencies

```bash
# From root
npm run install:all
```

### Configure .env files

```bash
cp services/auth-services/.env.example services/auth-services/.env
cp services/api-gateway/.env.example   services/api-gateway/.env
```

Edit both `.env` files with your values. **JWT_SECRET must be identical in both.**

### Initialise database

```bash
cd services/auth-services
node scripts/db_init.js
```

This syncs Sequelize models to MySQL (creates tables automatically).

### Start services (two terminals)

```bash
# Terminal 1 — Auth Service
cd services/auth-services && npm run dev

# Terminal 2 — API Gateway
cd services/api-gateway && npm run dev
```

---

## API Reference

All requests go through the **API Gateway on port 3000**.

### Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new investor |
| GET | `/auth/verifyemail?token=` | Public | Verify email from link |
| POST | `/auth/login` | Public | Login, returns JWT |
| POST | `/auth/logout` | JWT | Logout, clears session |
| POST | `/auth/refresh` | Cookie | Silent token refresh |
| GET | `/auth/me` | JWT | Get current user |
| POST | `/auth/forgot-password` | Public | Request password reset |
| POST | `/auth/reset-password` | Public | Reset with token |
| GET | `/auth/walletnonce?address=` | JWT | Get wallet signing nonce |
| POST | `/auth/wallet-bind` | JWT | Bind wallet to account |

### Example: Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "investor@example.com",
    "password": "SecurePass1!",
    "firstName": "Jane",
    "lastName": "Doe",
    "countryOfResidence": "US"
  }'
```

### Example: Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "investor@example.com",
    "password": "SecurePass1!"
  }'
```

The response includes `accessToken`. The `refreshToken` is set as an `httpOnly` cookie automatically.

### Example: Silent Token Refresh

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -b cookies.txt
```

### Example: Get Wallet Nonce

```bash
curl -X GET "http://localhost:3000/auth/walletnonce?address=0xYourEthAddress" \
  -H "Authorization: Bearer <accessToken>"
```

### Example: Bind Wallet

```bash
curl -X POST http://localhost:3000/auth/wallet-bind \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xYourEthAddress",
    "signature": "0xSignatureFromWallet",
    "nonce": "nonceFromPreviousStep"
  }'
```

---

## Security Highlights

- **JWT access tokens**: 15-minute expiry, stored in-memory on client (never localStorage)
- **Refresh tokens**: 7-day expiry, stored as `httpOnly Secure SameSite=Strict` cookie, hashed in DB
- **Passwords**: bcrypt with cost factor 12
- **Login rate limiting**: 5 failed attempts → 15-minute account lockout (tracked per user in DB)
- **API Gateway rate limiting**: 200 requests/minute per IP globally
- **Wallet nonces**: Single-use, 5-minute expiry, deleted immediately after use
- **Wallet addresses**: Stored in EIP-55 checksum format via `ethers.getAddress()`
- **Anti-enumeration**: Forgot password always returns the same message regardless of email existence
- **Audit log**: Every auth event written to `audit_logs` table with IP, user agent, and metadata
- **Helmet**: Security headers on all responses

---

## Project Structure

```
linkeymicroservices/
├── docker-compose.yml
├── package.json
└── services/
    ├── api-gateway/
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/
    │       ├── index.js
    │       ├── config/
    │       │   ├── app.js
    │       │   └── services.js
    │       ├── middlewares/
    │       │   ├── error.middleware.js
    │       │   ├── notFound.middleware.js
    │       │   ├── rateLimiter.middleware.js
    │       │   └── requestLogger.middleware.js
    │       └── utils/
    │           └── logger.js
    └── auth-services/
        ├── Dockerfile
        ├── package.json
        ├── .sequelizerc
        ├── scripts/
        │   └── db_init.js
        └── src/
            ├── index.js
            ├── config/
            │   ├── app.js
            │   ├── database.js
            │   └── jwt.js
            ├── controllers/
            │   ├── auth.controller.js
            │   ├── wallet.controller.js
            │   └── password.controller.js
            ├── events/
            │   └── auth.events.js
            ├── middlewares/
            │   ├── auth.middleware.js
            │   ├── error.middleware.js
            │   ├── notFound.middleware.js
            │   ├── rateLimiter.middleware.js
            │   └── validate.middleware.js
            ├── models/
            │   ├── index.js
            │   ├── User.js
            │   ├── AuditLog.js
            │   └── WalletNonce.js
            ├── routes/
            │   └── auth.routes.js
            ├── seeders/
            │   └── roles.seeder.js
            ├── utils/
            │   ├── AppError.js
            │   ├── auditLog.util.js
            │   ├── crypto.util.js
            │   ├── email.util.js
            │   ├── jwt.util.js
            │   └── logger.js
            └── validators/
                └── auth.validator.js
```

---

## Error Codes

| Code | HTTP | Scenario |
|---|---|---|
| AUTH_001 | 409 | Email already registered |
| AUTH_002 | 401 | Invalid email or password |
| AUTH_003 | 410 | Email verification token expired |
| AUTH_004 | 423 | Account locked due to failed attempts |
| AUTH_005 | 409 | Wallet already bound to another account |
| AUTH_006 | 401 | Invalid or expired JWT |
| AUTH_007 | 403 | Account suspended or deactivated |
