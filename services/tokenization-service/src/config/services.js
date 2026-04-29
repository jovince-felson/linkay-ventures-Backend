import dotenv from "dotenv";
dotenv.config();

export const SERVICES = {
    asset_service: process.env.ASSET_SERVICE_URL || "http://localhost:4004/api/v1",
    user_service: process.env.USER_SERVICE_URL || "http://localhost:4001/api/v1",
};

export const BLOCKCHAIN = {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
    chainId: parseInt(process.env.BLOCKCHAIN_CHAIN_ID),
    platformWalletPrivateKey: process.env.PLATFORM_WALLET_PRIVATE_KEY,
    platformWalletAddress: process.env.PLATFORM_WALLET_ADDRESS,
    contracts: {
        nftFactory: process.env.NFT_FACTORY_ADDRESS,
        fractionalTokenFactory: process.env.FRACTIONAL_TOKEN_FACTORY_ADDRESS,
        identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS,
        complianceModule: process.env.COMPLIANCE_MODULE_ADDRESS,
    },
};

export const PINATA = {
    apiKey: process.env.PINATA_API_KEY,
    secretKey: process.env.PINATA_SECRET_KEY,
    gateway: process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud",
};

export const REDIS = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};
