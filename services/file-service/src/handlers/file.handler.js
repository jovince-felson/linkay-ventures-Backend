import { listenToEvent } from 'linkay-shared-utils';
import { Topics, Keys }  from 'linkay-shared-utils';
import { logger }        from 'linkay-shared-utils';
import { Media }         from '../models/index.js';
import { deleteS3Object } from '../utils/s3.js';

async function onAssetDeleted(key, data) {
  const { assetId } = data;
  try {
    const mediaList = await Media.findAll({ where: { assetId } });
    for (const m of mediaList) {
      await deleteS3Object(m.fileKey).catch((err) =>
        logger.warn(`S3 delete failed for ${m.fileKey}:`, err.message),
      );
      await m.destroy();
    }
    logger.info(`Cleaned up ${mediaList.length} media file(s) for deleted asset ${assetId}`);
  } catch (err) {
    logger.error(`Media cleanup for asset ${assetId} failed:`, err.message);
  }
}

export async function initFileConsumer() {
  await listenToEvent(
    'file-service-asset-events-group',
    Topics.ASSET_EVENTS,
    async (key, data) => {
      if (key === Keys.ASSET_DELETED) await onAssetDeleted(key, data);
    },
  );
}
