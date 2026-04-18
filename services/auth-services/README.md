# Auth Service — Linkay Ventures

Handles registration, login, JWT access/refresh token lifecycle, and role-based authorization.

---

## Stack

| Layer       | Tech                          |
|-------------|-------------------------------|
| Runtime     | Node.js 20                    |
| Framework   | Express.js                    |
| ORM         | Sequelize v6                  |
| Database    | MySQL 8                       |
| Auth        | JWT (access + refresh tokens) |
| Hashing     | bcryptjs                      |
| Validation  | express-validator             |
| Security    | helmet, cors                  |

---

## API Endpoints

| Method | Endpoint          | Auth     | Description            |
|--------|-------------------|----------|------------------------|
| POST   | /api/auth/register | Public  | Create new account     |
| POST   | /api/auth/login    | Public  | Login, get tokens      |
| POST   | /api/auth/refresh  | Public  | Rotate refresh token   |
| POST   | /api/auth/logout   | Public  | Revoke refresh token   |
| GET    | /api/auth/me       | Bearer  | Get current user       |
| GET    | /health            | Public  | Health check           |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in DB and JWT values

# 3. Run migrations (creates tables)
npm run migrate

# 4. Start in dev mode
npm run dev
```

## Docker

```bash
docker build -t linkay-auth-service .
docker run -p 3003:3003 --env-file .env linkay-auth-service
```

## Token Flow

```
POST /register  →  account created
POST /login     →  { accessToken (15m), refreshToken (7d) }
GET  /me        →  Authorization: Bearer <accessToken>
POST /refresh   →  { refreshToken } → new token pair (old is revoked)
POST /logout    →  { refreshToken } → token revoked in DB
```

## Project Structure

```
src/
├── config/         env.js, database.js
├── models/         user.model.js, refresh-token.model.js
├── services/       auth.service.js  (all business logic)
├── controllers/    auth.controller.js
├── middlewares/    auth.middleware.js, validate.middleware.js
├── validators/     auth.validator.js
├── routes/         auth.routes.js
├── utils/          jwt.js, hash.js, response.js
└── index.js
migrations/
└── migrate.js
```
