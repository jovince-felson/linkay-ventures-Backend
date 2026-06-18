import { Op }             from 'sequelize';
import { v4 as uuidv4 }   from 'uuid';
import sequelize          from '../config/database.js';
import { Asset, AssetOwnership, AssetTokenization, Auction } from '../models/index.js';
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

function tzOffsetMinutes(tz) {
  if (!tz || tz === 'UTC') return 0;
  const m = tz.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/i);
  if (m) {
    const sign  = m[1] === '+' ? 1 : -1;
    const hours = parseInt(m[2], 10);
    const mins  = parseInt(m[3] ?? '0', 10);
    return sign * (hours * 60 + mins);
  }
  try {
    const d       = new Date();
    const utcStr  = d.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const locStr  = d.toLocaleString('en-US', { timeZone: tz,    hour12: false });
    return (new Date(locStr) - new Date(utcStr)) / 60000;
  } catch { return 0; }
}

function toUTCIso(dateStr, timeStr, timezone) {
  const offsetMs = tzOffsetMinutes(timezone) * 60 * 1000;
  const localMs  = new Date(`${dateStr}T${timeStr}:00.000Z`).getTime();
  return new Date(localMs - offsetMs).toISOString();
}

function generateSlug(title) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${uuidv4().slice(0, 8)}`;
}

// ── GET /assets ────────────────────────────────────────────────────────────────
export async function listAssets(req, res) {
  const { page, limit, offset } = buildPagination(req.query);
  const { status, assetType, search, museumId: queryMuseumId, tokenizationStatus } = req.query;
  const order = buildSortOrder(req.query, ['title', 'status', 'created_at', 'published_at']);

  const where = {};
  if (assetType) where.assetType = assetType;
  if (search)    where.title     = { [Op.like]: `%${search}%` };

  if (req.user.role === 'MUSEUM_ADMIN') {
    // Museum admin sees only their own assets (any status)
    where.museumId = req.user.museumId || req.user.userId;
    if (status) where.status = status;
  } else if (req.user.role === 'INVESTOR') {
    // Investor sees only LIVE assets from all museums
    where.status = 'LIVE';
    if (queryMuseumId) where.museumId = queryMuseumId;
  } else {
    // SUPER_ADMIN sees all assets, optional filters
    if (status)        where.status   = status;
    if (queryMuseumId) where.museumId = queryMuseumId;
  }

  const tokenizationInclude = tokenizationStatus && req.user.role === 'SUPER_ADMIN'
    ? { model: AssetTokenization, as: 'tokenization', required: true,  where: { tokenizationStatus }, paranoid: false }
    : { model: AssetTokenization, as: 'tokenization', required: false, paranoid: false };

  const { count, rows } = await Asset.findAndCountAll({
    where,
    limit,
    offset,
    order,
    include: [
      { model: AssetOwnership, as: 'ownershipSplit', paranoid: false },
      tokenizationInclude,
      {
        model:    Auction,
        as:       'auctions',
        required: false,
        attributes: ['id', 'status', 'startDate', 'startTime', 'endDate', 'endTime', 'timezone', 'onChainAuctionId', 'showCountdown', 'reservePrice', 'startingBidPrice', 'createdAt'],
        order:    [['createdAt', 'DESC']],
        limit:    1,
      },
    ],
  });

  const rowsWithLatestAuction = rows.map((asset) => {
    const plain = asset.toJSON();
    const auction = plain.auctions?.[0] ?? null;
    if (auction?.endDate && auction?.endTime) {
      auction.endDateTimeUTC = toUTCIso(auction.endDate, auction.endTime, auction.timezone);
    }
    plain.latestAuction = auction;
    delete plain.auctions;
    return plain;
  });

  return sendPaginated(res, rowsWithLatestAuction, buildPaginationMeta(count, page, limit));
}

// ── GET /assets/marketplace (INVESTOR) ────────────────────────────────────────
export async function listLiveAssets(req, res) {
  const { page, limit, offset } = buildPagination(req.query);
  const { assetType, search, museumId: queryMuseumId } = req.query;
  const order = buildSortOrder(req.query, ['title', 'created_at', 'published_at']);

  const where = { status: 'LIVE' };
  if (assetType)     where.assetType = assetType;
  if (search)        where.title     = { [Op.like]: `%${search}%` };
  if (queryMuseumId) where.museumId  = queryMuseumId;

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
// ── helpers ────────────────────────────────────────────────────────────────────

/** Normalise req.files for both .array() and .fields() multer configs */
function getUploadedFiles(req) {
  if (!req.files) return { mediaFiles: [], dynamicFieldFiles: [] };
  if (Array.isArray(req.files)) {
    // legacy .array() config — all files are media files
    return { mediaFiles: req.files, dynamicFieldFiles: [] };
  }
  // .fields() config
  return {
    mediaFiles:        req.files.mediaFiles        || [],
    dynamicFieldFiles: req.files.dynamicFieldFiles || [],
  };
}

/**
 * Merge uploaded dynamic-field files directly into the dynamicFields JSON array.
 * dynamicFieldMeta : JSON string — array of field indices, one per uploaded file
 *                    e.g. "[0, 0, 1]"  means file[0]→field[0], file[1]→field[0], file[2]→field[1]
 * dynamicFieldsArr : current dynamicFields array from the asset (already normalised)
 * Returns a NEW array with fieldValue set to an array of file-path strings.
 */
/**
 * Merge uploaded file paths directly into each file_upload field's fieldValue.
 * meta: array of field indices (already parsed — one number per uploaded file)
 *       e.g. [0, 0, 1]  →  file[0]→field[0], file[1]→field[0], file[2]→field[1]
 */
function mergeFilesIntoDynamicFields(dynamicFieldsArr, uploadedFiles, meta) {
  if (!uploadedFiles.length || !Array.isArray(dynamicFieldsArr) || !dynamicFieldsArr.length) {
    return dynamicFieldsArr;
  }

  // meta is now a parsed array (not a JSON string)
  const metaArr = Array.isArray(meta) ? meta : [];

  // Deep-clone so we don't mutate the original
  const fields = dynamicFieldsArr.map((f) => ({
    ...f,
    fieldValue: f.fieldValue ?? null,
  }));

  uploadedFiles.forEach((file, fileIdx) => {
    const fieldIndex = metaArr[fileIdx];
    if (fieldIndex === undefined || fieldIndex === null) return;

    const field = fields[fieldIndex];
    if (!field || field.fieldType !== 'file_upload') return;

    const filePath = `/uploads/assets/${file.filename}`;

    // Accumulate file paths as an array inside fieldValue
    const existing = Array.isArray(field.fieldValue)
      ? field.fieldValue
      : (field.fieldValue ? [field.fieldValue] : []);

    field.fieldValue = [...existing, filePath];
  });

  return fields;
}

export async function createAsset(req, res) {
  const {
    title, description, assetType, valuation, jurisdiction, dynamicFields = [],
    custodian, ownershipEntity, historicalContext, totalFractions, tokenizedPercent, retainedPercent,
    pricePerFraction, conditionReport, certificationRef, royaltyPercent, royaltyWallet,
    threeDModelUrl,
  } = req.body;
  const userId        = req.user.userId;
  const museumId      = req.user.museumId || req.user.userId;
  const createdByName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;

  const t = await sequelize.transaction();
  try {
    const asset = await Asset.create(
      {
        title,
        slug:              generateSlug(title),
        description,
        assetType,
        valuation:         valuation ? parseFloat(valuation) : null,
        jurisdiction:      jurisdiction || null,
        status:            'DRAFT',
        museumId,
        createdBy:         userId,
        createdByName,
        custodian:         custodian         || null,
        ownershipEntity:   ownershipEntity   || null,
        historicalContext: historicalContext || null,
        totalFractions:    totalFractions    || null,
        tokenizedPercent:  tokenizedPercent  ?? null,
        retainedPercent:   retainedPercent   ?? null,
        pricePerFraction:  pricePerFraction  || null,
        conditionReport:   conditionReport   || null,
        certificationRef:  certificationRef  || null,
        royaltyPercent:    royaltyPercent    ?? null,
        royaltyWallet:     royaltyWallet     || null,
        threeDModelUrl:    threeDModelUrl    || null,
        dynamicFields:     dynamicFields.length
          ? dynamicFields.map((f, i) => ({
              fieldKey:     f.fieldKey || f.fieldLabel?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `field_${i}`,
              fieldLabel:   f.fieldLabel,
              fieldType:    f.fieldType,
              fieldOptions: f.fieldOptions || null,
              fieldValue:   f.fieldValue   || null,
              fieldOrder:   f.fieldOrder   ?? i,
              isRequired:   f.isRequired   ?? false,
            }))
          : null,
      },
      { transaction: t },
    );

    await t.commit();

    const result = await Asset.findByPk(asset.id);

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
      { model: AssetOwnership,    as: 'ownershipSplit', paranoid: false },
      { model: AssetTokenization, as: 'tokenization',   required: false, paranoid: false },
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

  const {
    title, description, valuation, jurisdiction,
    custodian, ownershipEntity, historicalContext, totalFractions, tokenizedPercent, retainedPercent,
    pricePerFraction, conditionReport, certificationRef, royaltyPercent, royaltyWallet,
    threeDModelUrl,
  } = req.body;
  const userId = req.user.userId;

  // dynamicFields may arrive as a JSON string (multipart) or a parsed array (JSON body)
  let dynamicFields = req.body.dynamicFields;
  if (typeof dynamicFields === 'string') {
    try { dynamicFields = JSON.parse(dynamicFields); } catch { dynamicFields = undefined; }
  }

  // Convert uploaded buffers to base64 data URLs for DB storage
  const uploadedMedia = (req.files?.mediaFiles ?? []).map(
    (f) => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`,
  );
  const uploadedDynamicFiles = req.files?.dynamicFieldFiles ?? [];

  const t = await sequelize.transaction();
  try {
    // Merge uploaded media with existing stored paths
    const existingMedia = Array.isArray(asset.mediaFiles) ? asset.mediaFiles : [];
    const mergedMedia   = uploadedMedia.length ? [...existingMedia, ...uploadedMedia] : undefined;

    // Merge dynamic-field file uploads into their respective fieldValue entries
    let mergedDynamicFields = dynamicFields;
    if (uploadedDynamicFiles.length && dynamicFields) {
      let meta = [];
      try { meta = JSON.parse(req.body.dynamicFieldMeta ?? '[]'); } catch { meta = []; }
      const fields = Array.isArray(dynamicFields) ? [...dynamicFields] : [];
      uploadedDynamicFiles.forEach((f, i) => {
        const fieldIdx = meta[i] ?? -1;
        if (fieldIdx >= 0 && fields[fieldIdx]) {
          const dataUrl  = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
          const existing = fields[fieldIdx].fieldValue;
          const prev     = existing ? String(existing).split(', ').filter(Boolean) : [];
          fields[fieldIdx] = { ...fields[fieldIdx], fieldValue: [...prev, dataUrl].join(', ') };
        }
      });
      mergedDynamicFields = fields;
    }

    await asset.update(
      {
        title,
        description,
        custodian:         custodian          !== undefined ? (custodian || null)          : undefined,
        ownershipEntity:   ownershipEntity    !== undefined ? (ownershipEntity || null)    : undefined,
        valuation:         valuation         !== undefined ? (valuation ? parseFloat(valuation) : null) : undefined,
        jurisdiction:      jurisdiction       !== undefined ? (jurisdiction || null)       : undefined,
        historicalContext: historicalContext  !== undefined ? (historicalContext || null)  : undefined,
        totalFractions:    totalFractions     !== undefined ? (totalFractions || null)     : undefined,
        tokenizedPercent:  tokenizedPercent   !== undefined ? (tokenizedPercent ?? null)   : undefined,
        retainedPercent:   retainedPercent    !== undefined ? (retainedPercent ?? null)    : undefined,
        pricePerFraction:  pricePerFraction   !== undefined ? (pricePerFraction || null)   : undefined,
        conditionReport:   conditionReport    !== undefined ? (conditionReport || null)    : undefined,
        certificationRef:  certificationRef   !== undefined ? (certificationRef || null)   : undefined,
        royaltyPercent:    royaltyPercent     !== undefined ? (royaltyPercent ?? null)     : undefined,
        royaltyWallet:     royaltyWallet      !== undefined ? (royaltyWallet || null)      : undefined,
        threeDModelUrl:    threeDModelUrl     !== undefined ? (threeDModelUrl || null)     : undefined,
        ...(mergedMedia !== undefined && { mediaFiles: mergedMedia }),
        ...(mergedDynamicFields !== undefined && {
          dynamicFields: mergedDynamicFields.length
            ? mergedDynamicFields.map((f, i) => ({
                fieldKey:     f.fieldKey || f.fieldLabel?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `field_${i}`,
                fieldLabel:   f.fieldLabel,
                fieldType:    f.fieldType,
                fieldOptions: f.fieldOptions || null,
                fieldValue:   f.fieldValue   || null,
                fieldOrder:   f.fieldOrder   ?? i,
                isRequired:   f.isRequired   ?? false,
              }))
            : null,
        }),
        updatedBy:         userId,
      },
      { transaction: t },
    );

    await t.commit();

    const updated = await Asset.findByPk(asset.id, {
      include: [
        { model: AssetOwnership, as: 'ownershipSplit', paranoid: false },
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
    { model: AssetOwnership, as: 'ownershipSplit', paranoid: false },
  ]);
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (!['DRAFT', 'REVIEW'].includes(asset.status)) {
    return sendError(res, `Asset is already ${asset.status}`, 409);
  }

  const existingMedia = Array.isArray(asset.mediaFiles) ? asset.mediaFiles : [];
  if (!existingMedia.length) {
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
      { model: AssetOwnership,    as: 'ownershipSplit',  paranoid: false },
      { model: AssetTokenization, as: 'tokenization',    required: false, paranoid: false },
    ],
  });
  if (!asset) return sendNotFound(res, 'Asset not found');

  const media = Array.isArray(asset.mediaFiles) ? asset.mediaFiles : [];

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




// ── GET /assets/admin-stats ───────────────────────────────────────────────────
export async function adminStats(req, res) {
  if (req.user.role !== 'SUPER_ADMIN') {
    return sendError(res, 'SUPER_ADMIN only', 403);
  }

  const [[pending], [live], [[totals]]] = await Promise.all([
    sequelize.query(
      'SELECT COUNT(*) AS cnt FROM asset_tokenizations WHERE tokenization_status = ?',
      { replacements: ['TREASURY_PENDING'] },
    ),
    sequelize.query(
      'SELECT COUNT(*) AS cnt FROM auctions WHERE status = ? AND deleted_at IS NULL',
      { replacements: ['LIVE'] },
    ),
    sequelize.query(
      'SELECT COUNT(*) AS totalAssets, COALESCE(SUM(valuation), 0) AS totalValue FROM assets WHERE deleted_at IS NULL',
    ),
  ]);

  return sendSuccess(res, {
    pendingTreasuryCount:  Number(pending.cnt),
    liveAuctionsCount:     Number(live.cnt),
    totalAssetsCount:      Number(totals.totalAssets),
    totalAssetValue:       Number(totals.totalValue),
  });
}

// 1. Museum Admin login  → get TOKEN + userId (museumAdmin userId)
// 2. Create asset        → use TOKEN → get assetId
// 3. Investor login      → get investor userId
// 4. Set ownership       → use same assetId from step 2
// 5. Change status       → use same assetId
// 6. Publish             → use same assetId