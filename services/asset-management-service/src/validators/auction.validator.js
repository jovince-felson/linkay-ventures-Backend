import Joi from 'joi';

export const createAuctionSchema = Joi.object({
  assetId:            Joi.string().uuid().required(),
  title:              Joi.string().min(1).max(500).required(),
  description:        Joi.string().max(10000).allow('', null).optional(),

  fractionsAllocated: Joi.number().integer().min(1).required(),
  minPurchaseQty:     Joi.number().integer().min(1).required(),
  maxPurchaseQty:     Joi.number().integer().min(1).required(),
  startingBidPrice:   Joi.number().positive().required(),
  reservePrice:       Joi.number().positive().required(),
  minIncrement:       Joi.number().positive().required(),

  startDate:          Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  startTime:          Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endDate:            Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  endTime:            Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  timezone:           Joi.string().max(20).default('UTC'),
  showCountdown:      Joi.boolean().default(true),

  status:             Joi.string().valid('DRAFT', 'SCHEDULED').default('SCHEDULED'),
});

export const updateAuctionSchema = Joi.object({
  title:              Joi.string().min(1).max(500).optional(),
  description:        Joi.string().max(10000).allow('', null).optional(),

  fractionsAllocated: Joi.number().integer().min(1).optional(),
  minPurchaseQty:     Joi.number().integer().min(1).optional(),
  maxPurchaseQty:     Joi.number().integer().min(1).optional(),
  startingBidPrice:   Joi.number().positive().optional(),
  reservePrice:       Joi.number().positive().optional(),
  minIncrement:       Joi.number().positive().optional(),

  startDate:          Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime:          Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  endDate:            Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endTime:            Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  timezone:           Joi.string().max(20).optional(),
  showCountdown:      Joi.boolean().optional(),
});

export const patchAuctionStatusSchema = Joi.object({
  status: Joi.string().valid('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED').required(),
});
