import { Op }             from 'sequelize';
import { v4 as uuidv4 }   from 'uuid';
import axios              from 'axios';
import sequelize          from '../config/database.js';
import { Asset, AssetDynamicField, AssetOwnership, AssetTokenization } from '../models/index.js';
import { assetEvents }    from '../events/asset.events.js';
import {
  sendSuccess, sendCreated, sendPaginated,
  sendNotFound, sendError, sendValidationError,
} from '../utils/response.js';
import {
  buildPagination, buildPaginationMeta, buildSortOrder,
} from '../utils/pagination.js';
import { logger } from 'linkay-shared-utils';

const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://file-service:4007/api/v1';

function generateSlug(title) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${uuidv4().slice(0, 8)}`;
}

// ── GET /assets ────────────────────────────────────────────────────────────────
export async function listAssets(req, res) {
  const { page, limit, offset } = buildPagination(req.query);
  const { status, assetType, search, museumId: queryMuseumId } = req.query;
  const order = buildSortOrder(req.query, ['title', 'status', 'created_at', 'published_at']);

  const where = {};
  if (status)    where.status    = status;
  if (assetType) where.assetType = assetType;
  if (search)    where.title     = { [Op.like]: `%${search}%` };

  if (req.user.role === 'MUSEUM_ADMIN') {
    where.museumId = req.user.museumId || req.user.userId;
  } else if (queryMuseumId) {
    where.museumId = queryMuseumId;
  }

  const { count, rows } = await Asset.findAndCountAll({
    where,
    limit,
    offset,
    order,
    include: [
      { model: AssetOwnership,    as: 'ownershipSplit', paranoid: false },
      { model: AssetTokenization, as: 'tokenization',   required: false, paranoid: false },
    ],
  });

  return sendPaginated(res, rows, buildPaginationMeta(count, page, limit));
}

// ── POST /assets ───────────────────────────────────────────────────────────────
export async function createAsset(req, res) {
  const { title, description, assetType, dynamicFields = [] } = req.body;
  const userId   = req.user.userId;
  const museumId = req.user.museumId || req.user.userId;

  const t = await sequelize.transaction();
  try {
    const asset = await Asset.create(
      {
        title,
        slug:        generateSlug(title),
        description,
        assetType,
        status:      'DRAFT',
        museumId,
        createdBy:   userId,
      },
      { transaction: t },
    );

    if (dynamicFields.length) {
      await AssetDynamicField.bulkCreate(
        dynamicFields.map((f, i) => ({
          assetId:      asset.id,
          fieldKey:     f.fieldKey,
          fieldLabel:   f.fieldLabel,
          fieldType:    f.fieldType,
          fieldOptions: f.fieldOptions || null,
          fieldValue:   f.fieldValue   || null,
          fieldOrder:   f.fieldOrder   ?? i,
          isRequired:   f.isRequired   ?? false,
          parentId:     f.parentId     || null,
        })),
        { transaction: t },
      );
    }

    await t.commit();

    const result = await Asset.findByPk(asset.id, {
      include: [{ model: AssetDynamicField, as: 'dynamicFields' }],
    });

    assetEvents.created(result).catch(() => {});
    return sendCreated(res, result, 'Asset created successfully');
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// helper — returns the asset only if it belongs to the caller's museum
async function findOwnedAsset(assetId, user, include = []) {
  const where = { id: assetId };
  if (user.role === 'MUSEUM_ADMIN') {
    where.museumId = user.museumId || user.userId;
  }
  return Asset.findOne({ where, include });
}

// ── GET /assets/:id ────────────────────────────────────────────────────────────
export async function getAsset(req, res) {
  const asset = await Asset.findByPk(req.params.assetId, {
    include: [
      { model: AssetDynamicField,  as: 'dynamicFields' },
      { model: AssetOwnership,     as: 'ownershipSplit', paranoid: false },
      { model: AssetTokenization,  as: 'tokenization',   required: false, paranoid: false },
    ],
  });
  if (!asset) return sendNotFound(res, 'Asset not found');
  return sendSuccess(res, asset);
}

// ── PATCH /assets/:id ──────────────────────────────────────────────────────────
export async function updateAsset(req, res) {
  const asset = await findOwnedAsset(req.params.assetId, req.user);
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (['LIVE', 'ARCHIVED'].includes(asset.status)) {
    return sendError(res, 'Cannot edit a LIVE or ARCHIVED asset', 409);
  }

  const { title, description, dynamicFields } = req.body;
  const userId = req.user.userId;

  const t = await sequelize.transaction();
  try {
    await asset.update(
      { title, description, updatedBy: userId },
      { transaction: t },
    );

    if (dynamicFields !== undefined) {
      await AssetDynamicField.destroy({ where: { assetId: asset.id }, transaction: t });
      if (dynamicFields.length) {
        await AssetDynamicField.bulkCreate(
          dynamicFields.map((f, i) => ({
            assetId:      asset.id,
            fieldKey:     f.fieldKey,
            fieldLabel:   f.fieldLabel,
            fieldType:    f.fieldType,
            fieldOptions: f.fieldOptions || null,
            fieldValue:   f.fieldValue   || null,
            fieldOrder:   f.fieldOrder   ?? i,
            isRequired:   f.isRequired   ?? false,
            parentId:     f.parentId     || null,
          })),
          { transaction: t },
        );
      }
    }

    await t.commit();

    const updated = await Asset.findByPk(asset.id, {
      include: [
        { model: AssetDynamicField, as: 'dynamicFields' },
        { model: AssetOwnership,    as: 'ownershipSplit', paranoid: false },
      ],
    });

    assetEvents.updated(updated).catch(() => {});
    return sendSuccess(res, updated, 'Asset updated successfully');
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ── DELETE /assets/:id ─────────────────────────────────────────────────────────
export async function deleteAsset(req, res) {
  const asset = await findOwnedAsset(req.params.assetId, req.user);
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (asset.status === 'LIVE') {
    return sendError(res, 'Cannot delete a LIVE asset. Archive it first.', 409);
  }

  await asset.destroy();
  assetEvents.deleted(asset.id, req.user.userId).catch(() => {});
  return sendSuccess(res, null, 'Asset deleted successfully');
}

// ── PATCH /assets/:id/status ──────────────────────────────────────────────────
export async function patchAssetStatus(req, res) {
  const asset = await findOwnedAsset(req.params.assetId, req.user);
  if (!asset) return sendNotFound(res, 'Asset not found');

  const { status } = req.body;
  const previousStatus = asset.status;

  const allowedTransitions = {
    DRAFT:    ['REVIEW'],
    REVIEW:   ['LIVE', 'DRAFT'],
    LIVE:     ['ARCHIVED'],
    ARCHIVED: ['LIVE'],
  };

  if (!allowedTransitions[previousStatus]?.includes(status)) {
    return sendError(
      res,
      `Cannot transition from ${previousStatus} to ${status}. Allowed: ${allowedTransitions[previousStatus]?.join(', ')}`,
      422,
    );
  }

  const updates = { status, updatedBy: req.user.userId };
  if (status === 'LIVE')     updates.publishedAt = new Date();
  if (status === 'ARCHIVED') updates.archivedAt  = new Date();

  await asset.update(updates);
  assetEvents.statusChanged(asset, previousStatus).catch(() => {});

  return sendSuccess(res, asset, `Asset status updated to ${status}`);
}

// ── PATCH /assets/:id/publish ──────────────────────────────────────────────────
export async function publishAsset(req, res) {
  const asset = await findOwnedAsset(req.params.assetId, req.user, [
    { model: AssetDynamicField, as: 'dynamicFields' },
    { model: AssetOwnership,    as: 'ownershipSplit', paranoid: false },
  ]);
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (!['DRAFT', 'REVIEW'].includes(asset.status)) {
    return sendError(res, `Asset is already ${asset.status}`, 409);
  }

  let mediaList = [];
  try {
    const { data } = await axios.get(`${FILE_SERVICE_URL}/files`, {
      params: { assetId: asset.id, mediaType: 'IMAGE' },
      headers: { authorization: req.headers.authorization },
      timeout: 5000,
    });
    mediaList = data?.data || [];
  } catch (err) {
    logger.warn(`Could not fetch media for asset ${asset.id}:`, err.message);
  }

  if (!mediaList.length) {
    return sendValidationError(res, ['At least one image is required before publishing']);
  }

  const owners = asset.ownershipSplit || [];
  if (!owners.length) {
    return sendValidationError(res, ['Ownership split must be defined before publishing']);
  }
  const total = owners.reduce((s, o) => s + parseFloat(o.percentage), 0);
  if (Math.round(total * 100) !== 10000) {
    return sendValidationError(res, [`Ownership split must total 100%. Current: ${total.toFixed(2)}%`]);
  }

  await asset.update({
    status:      'LIVE',
    publishedAt: new Date(),
    updatedBy:   req.user.userId,
  });

  assetEvents.published(asset).catch(() => {});
  return sendSuccess(res, asset, 'Asset published successfully');
}

// ── GET /assets/:id/preview ───────────────────────────────────────────────────
export async function previewAsset(req, res) {
  const asset = await Asset.findByPk(req.params.assetId, {
    include: [
      { model: AssetDynamicField,  as: 'dynamicFields',  required: false },
      { model: AssetOwnership,     as: 'ownershipSplit',  paranoid: false },
      { model: AssetTokenization,  as: 'tokenization',    required: false, paranoid: false },
    ],
  });
  if (!asset) return sendNotFound(res, 'Asset not found');

  let media = [];
  try {
    const { data } = await axios.get(`${FILE_SERVICE_URL}/files`, {
      params: { assetId: asset.id },
      headers: { authorization: req.headers.authorization },
      timeout: 5000,
    });
    media = data?.data || [];
  } catch (err) {
    logger.warn(`Could not fetch media for preview of asset ${asset.id}:`, err.message);
  }

  return sendSuccess(res, {
    asset,
    media,
    ownershipSplit: asset.ownershipSplit,
    dynamicFields:  asset.dynamicFields,
    tokenization:   asset.tokenization,
  }, 'Asset preview');
}

// ── PUT /assets/:id/ownership ─────────────────────────────────────────────────
export async function upsertOwnership(req, res) {
  const asset = await findOwnedAsset(req.params.assetId, req.user);
  if (!asset) return sendNotFound(res, 'Asset not found');

  const { owners } = req.body;
  const total = owners.reduce((s, o) => s + o.percentage, 0);
  if (Math.round(total * 100) !== 10000) {
    return sendValidationError(res, [`Ownership must sum to 100. Got: ${total.toFixed(2)}`]);
  }

  const t = await sequelize.transaction();
  try {
    await AssetOwnership.destroy({ where: { assetId: asset.id }, transaction: t });
    await AssetOwnership.bulkCreate(
      owners.map((o) => ({ ...o, assetId: asset.id })),
      { transaction: t },
    );
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  const result = await AssetOwnership.findAll({ where: { assetId: asset.id } });
  return sendSuccess(res, result, 'Ownership split saved');
}




// 1. Museum Admin login  → get TOKEN + userId (museumAdmin userId)
// 2. Create asset        → use TOKEN → get assetId
// 3. Investor login      → get investor userId
// 4. Set ownership       → use same assetId from step 2
// 5. Change status       → use same assetId
// 6. Publish             → use same assetId