import Joi from 'joi';

const dynamicFieldSchema = Joi.object({
  id:           Joi.string().uuid().optional(),
  fieldKey:     Joi.string().max(100).required(),
  fieldLabel:   Joi.string().max(200).required(),
  fieldType:    Joi.string()
                   .lowercase()
                   .valid('text', 'textarea', 'number', 'dropdown', 'multi_select', 'date', 'checkbox', 'repeatable', 'file_upload')
                   .required(),
  fieldOptions: Joi.alternatives().try(
    Joi.array().items(
      Joi.object({
        label: Joi.string().optional(),
        value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).allow(null).optional(),
      })
    ),
    Joi.valid(null),
  ).optional(),
  fieldValue:  Joi.alternatives()
                  .try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
                  .allow(null)
                  .optional(),
  fieldOrder:  Joi.number().integer().min(0).default(0),
  isRequired:  Joi.boolean().default(false),
  parentId:    Joi.string().uuid().allow(null).optional(),
}).options({ allowUnknown: false });

const ASSET_TYPES = ['COLLECTIBLE', 'REAL_ESTATE', 'FINE_ART', 'LUXURY_ASSET', 'LUXURY_WATCH', 'OTHER'];

export const createAssetSchema = Joi.object({
  title:             Joi.string().min(1).max(500).required(),
  assetType:         Joi.string().valid(...ASSET_TYPES).required(),
  description:       Joi.string().max(10000).allow('', null).optional(),
  custodian:         Joi.string().max(300).allow('', null).optional(),
  ownershipEntity:   Joi.string().max(300).allow('', null).optional(),
  valuation:         Joi.number().positive().allow(null).optional(),
  jurisdiction:      Joi.string().max(200).allow('', null).optional(),
  threeDFiles:       Joi.string().max(2000).allow('', null).optional(),
  threeDModelUrl:    Joi.string().max(500).allow('', null).optional(),
  liveStream:        Joi.string().max(2000).allow('', null).optional(),
  status:            Joi.string().valid('DRAFT').optional(),
  dynamicFields:     Joi.array().items(dynamicFieldSchema).optional().default([]),
  // Array of field indices (parsed from JSON string by parseFormDataJsonFields middleware)
  dynamicFieldMeta:  Joi.array().items(Joi.number().integer()).allow(null).optional(),

  // tokenization fields
  historicalContext: Joi.string().max(10000).allow('', null).optional(),
  totalFractions:    Joi.number().integer().min(1).allow(null).optional(),
  tokenizedPercent:  Joi.number().min(0).max(100).allow(null).optional(),
  retainedPercent:   Joi.number().min(0).max(100).allow(null).optional(),
  pricePerFraction:  Joi.number().positive().allow(null).optional(),
  conditionReport:   Joi.string().max(10000).allow('', null).optional(),
  certificationRef:  Joi.string().max(200).allow('', null).optional(),
  royaltyPercent:    Joi.number().min(0).max(100).allow(null).optional(),
  royaltyWallet:     Joi.string().length(42).pattern(/^0x[a-fA-F0-9]{40}$/).allow('', null).optional(),
});

export const updateAssetSchema = Joi.object({
  title:             Joi.string().min(1).max(500).optional(),
  assetType:         Joi.string().valid(...ASSET_TYPES).optional(),
  description:       Joi.string().max(10000).allow('', null).optional(),
  custodian:         Joi.string().max(300).allow('', null).optional(),
  ownershipEntity:   Joi.string().max(300).allow('', null).optional(),
  valuation:         Joi.number().positive().allow(null).optional(),
  jurisdiction:      Joi.string().max(200).allow('', null).optional(),
  threeDFiles:       Joi.string().max(2000).allow('', null).optional(),
  threeDModelUrl:    Joi.string().max(500).allow('', null).optional(),
  liveStream:        Joi.string().max(2000).allow('', null).optional(),
  dynamicFields:     Joi.alternatives().try(
    Joi.array().items(dynamicFieldSchema),
    Joi.string(),
  ).optional(),

  // tokenization fields
  historicalContext: Joi.string().max(10000).allow('', null).optional(),
  totalFractions:    Joi.number().integer().min(1).allow(null).optional(),
  tokenizedPercent:  Joi.number().min(0).max(100).allow(null).optional(),
  retainedPercent:   Joi.number().min(0).max(100).allow(null).optional(),
  pricePerFraction:  Joi.number().positive().allow(null).optional(),
  conditionReport:   Joi.string().max(10000).allow('', null).optional(),
  certificationRef:  Joi.string().max(200).allow('', null).optional(),
  royaltyPercent:    Joi.number().min(0).max(100).allow(null).optional(),
  royaltyWallet:     Joi.string().length(42).pattern(/^0x[a-fA-F0-9]{40}$/).allow('', null).optional(),
});

export const upsertDynamicFieldsSchema = Joi.object({
  fields: Joi.array().items(dynamicFieldSchema).min(1).required(),
});

export const patchStatusSchema = Joi.object({
  status: Joi.string().valid('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED').required(),
});

export const assetQuerySchema = Joi.object({
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(10),
  status:    Joi.string().valid('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED').optional(),
  assetType: Joi.string().valid(...ASSET_TYPES).optional(),
  museumId:  Joi.number().integer().optional(),
  search:    Joi.string().max(200).optional(),
  sortBy:    Joi.string().valid('title', 'status', 'created_at', 'published_at').default('created_at'),
  sortDir:   Joi.string().valid('ASC', 'DESC').default('DESC'),
});
