# Linkay Ventures — Microservices Platform

A scalable Node.js microservices platform built with Docker and Express.

## 📁 Project Structure

```
linkay-ventures/
├── services/
│   ├── account-services/
│   ├── admin-services/
│   ├── api-gateway/
│   ├── auth-services/
│   ├── ekyc-services/
│   ├── file-service/
│   ├── log-services/
│   ├── notification-services/
│   ├── payment-services/
│   ├── referral-services/
│   ├── risk-services/
│   ├── socket-services/
│   ├── subscription-services/
│   ├── support-services/
│   ├── user-services/
│   └── wallet-services/
├── docker-compose.yml
├── .gitignore
├── .dockerignore
├── .gitattributes
├── LICENSE
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20
- Docker & Docker Compose
- Git

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd linkay-ventures

# Install dependencies (all workspaces)
npm install

# Start all services with Docker
npm run start

# Stop all services
npm run down
```

### Running a Single Service

```bash
cd services/<service-name>
cp .env.example .env
npm install
npm run dev
```

## 🐳 Docker

```bash
# Build all images
docker-compose build

# Start all containers
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🧪 Testing

```bash
npm test
```

## 📄 License

MIT © Linkay Ventures
