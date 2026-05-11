import axios from 'axios';
import { logger } from 'linkay-shared-utils';

const TOKENIZATION_SERVICE_URL = process.env.TOKENIZATION_SERVICE_URL ||
  'http://tokenization-service:4005/api/v1/tokenization';

export function buildMintPayload(asset, tokenization) {
  return {
    assetId:     asset.id,
    assetTitle:  asset.title,
    assetType:   asset.assetType,
    museumId:    asset.museumId,
    ipfsCid:     tokenization.ipfsCid,
    metadataUrl: tokenization.metadataUrl,
    ownershipSplit: tokenization.metadataJson?.ownershipSplit || {},
    network:     tokenization.blockchainNetwork || 'ethereum',
    requestedBy: tokenization.requestedBy,
  };
}

export async function sendMintRequest(mintPayload) {
  try {
    const response = await axios.post(
      `${TOKENIZATION_SERVICE_URL}/mint`,
      mintPayload,
      { timeout: 10000 },
    );
    return { success: true, data: response.data };
  } catch (err) {
    logger.error('Mint request to tokenization service failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function storeTransactionHash(tokenizationId, txHash, tokenAddress, tokenId) {
  return { tokenizationId, txHash, tokenAddress, tokenId };
}
