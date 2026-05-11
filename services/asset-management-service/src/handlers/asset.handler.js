import { listenToEvent }     from 'linkay-shared-utils';
import { Topics, Keys }       from 'linkay-shared-utils';
import { logger }             from 'linkay-shared-utils';
import { AssetTokenization }  from '../models/index.js';

async function onTokenizationCompleted(key, data) {
  const { assetId, tokenAddress, tokenId, transactionHash } = data;
  try {
    await AssetTokenization.update(
      {
        tokenAddress,
        tokenId,
        transactionHash,
        tokenizationStatus: 'COMPLETED',
      },
      { where: { assetId } },
    );
    logger.info(`Tokenization completed for asset ${assetId}`);
  } catch (err) {
    logger.error(`Failed to update tokenization for asset ${assetId}:`, err.message);
  }
}

async function onTokenizationFailed(key, data) {
  const { assetId, errorMessage } = data;
  try {
    await AssetTokenization.update(
      { tokenizationStatus: 'FAILED', errorMessage },
      { where: { assetId } },
    );
    logger.warn(`Tokenization failed for asset ${assetId}: ${errorMessage}`);
  } catch (err) {
    logger.error(`Failed to mark tokenization failed for asset ${assetId}:`, err.message);
  }
}

async function onMediaRegistered(key, data) {
  logger.info(`Media registered for asset ${data.assetId}: ${data.fileUrl}`);
}

export async function initAssetConsumer() {
  await listenToEvent(
    'asset-service-tokenization-group',
    Topics.TOKENIZATION_EVENTS,
    async (key, data) => {
      if (key === Keys.TOKENIZATION_COMPLETE) await onTokenizationCompleted(key, data);
      if (key === Keys.TOKENIZATION_FAILED)   await onTokenizationFailed(key, data);
    },
  );

  await listenToEvent(
    'asset-service-media-group',
    Topics.ASSET_EVENTS,
    async (key, data) => {
      if (key === Keys.ASSET_MEDIA_REGISTERED) await onMediaRegistered(key, data);
    },
  );
}
