import { publish }  from 'linkay-shared-utils';
import { Topics, Keys } from 'linkay-shared-utils';
import { logger }    from 'linkay-shared-utils';

async function emit(key, payload) {
  try {
    await publish(Topics.ASSET_EVENTS, [
      { key, value: JSON.stringify(payload) },
    ]);
  } catch (err) {
    logger.error(`Kafka emit [${key}] failed:`, err.message);
  }
}

export const assetEvents = {
  created(asset) {
    return emit(Keys.ASSET_CREATED, {
      assetId:   asset.id,
      title:     asset.title,
      assetType: asset.assetType,
      museumId:  asset.museumId,
      status:    asset.status,
      createdBy: asset.createdBy,
      ts:        new Date().toISOString(),
    });
  },

  updated(asset) {
    return emit(Keys.ASSET_UPDATED, {
      assetId:   asset.id,
      title:     asset.title,
      assetType: asset.assetType,
      status:    asset.status,
      updatedBy: asset.updatedBy,
      ts:        new Date().toISOString(),
    });
  },

  published(asset) {
    return emit(Keys.ASSET_PUBLISHED, {
      assetId:     asset.id,
      title:       asset.title,
      assetType:   asset.assetType,
      museumId:    asset.museumId,
      publishedAt: asset.publishedAt,
      ts:          new Date().toISOString(),
    });
  },

  deleted(assetId, deletedBy) {
    return emit(Keys.ASSET_DELETED, {
      assetId,
      deletedBy,
      ts: new Date().toISOString(),
    });
  },

  statusChanged(asset, previousStatus) {
    return emit(Keys.ASSET_STATUS_CHANGED, {
      assetId:        asset.id,
      previousStatus,
      newStatus:      asset.status,
      ts:             new Date().toISOString(),
    });
  },

  tokenizationRequested(asset, tokenization) {
    return emit(Keys.ASSET_TOKENIZATION_REQUESTED, {
      assetId:         asset.id,
      tokenizationId:  tokenization.id,
      ipfsCid:         tokenization.ipfsCid,
      metadataUrl:     tokenization.metadataUrl,
      mintPayload:     tokenization.mintPayload,
      blockchainNetwork: tokenization.blockchainNetwork,
      requestedBy:     tokenization.requestedBy,
      ts:              new Date().toISOString(),
    });
  },
};
