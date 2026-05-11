import { publish }    from 'linkay-shared-utils';
import { Topics, Keys } from 'linkay-shared-utils';
import { logger }      from 'linkay-shared-utils';

async function emit(key, payload) {
  try {
    await publish(Topics.ASSET_EVENTS, [{ key, value: JSON.stringify(payload) }]);
  } catch (err) {
    logger.error(`Kafka emit [${key}] failed:`, err.message);
  }
}

export const fileEvents = {
  mediaRegistered(media) {
    return emit(Keys.ASSET_MEDIA_REGISTERED, {
      mediaId:   media.id,
      assetId:   media.assetId,
      fileUrl:   media.fileUrl,
      fileKey:   media.fileKey,
      mediaType: media.mediaType,
      isPrimary: media.isPrimary,
      mimeType:  media.mimeType,
      fileSize:  media.fileSize,
      ts:        new Date().toISOString(),
    });
  },

  mediaDeleted(media, deletedBy) {
    return emit(Keys.ASSET_MEDIA_DELETED, {
      mediaId:   media.id,
      assetId:   media.assetId,
      fileKey:   media.fileKey,
      deletedBy,
      ts:        new Date().toISOString(),
    });
  },

  mediaReordered(assetId, reordered) {
    return emit(Keys.ASSET_MEDIA_REORDERED, {
      assetId,
      reordered,
      ts: new Date().toISOString(),
    });
  },
};
