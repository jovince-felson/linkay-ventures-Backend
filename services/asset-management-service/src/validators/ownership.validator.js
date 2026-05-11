import Joi from 'joi';

const ownerSchema = Joi.object({
  id:        Joi.string().uuid().optional(),
  ownerType: Joi.string().valid('MUSEUM', 'INVESTOR', 'PLATFORM').required(),
  ownerId:   Joi.when('ownerType', {
    switch: [
      { is: 'MUSEUM',   then: Joi.string().uuid().required().messages({ 'any.required': 'ownerId is required for MUSEUM owner' }) },
      { is: 'INVESTOR', then: Joi.string().uuid().required().messages({ 'any.required': 'ownerId is required for INVESTOR owner' }) },
      { is: 'PLATFORM', then: Joi.valid(null).default(null) },
    ],
  }),
  ownerName: Joi.string().max(200).allow('', null).optional(),
  percentage: Joi.number().min(0.01).max(100).precision(2).required(),
});

export const ownershipSplitSchema = Joi.object({
  owners: Joi.array().items(ownerSchema).min(1).required(),
}).custom((value, helpers) => {
  const total = value.owners.reduce((sum, o) => sum + o.percentage, 0);
  if (Math.round(total * 100) !== 10000) {
    return helpers.error('any.invalid', {
      message: `Ownership percentages must sum to 100. Current total: ${total.toFixed(2)}`,
    });
  }
  return value;
});

export const tokenizeSchema = Joi.object({
  blockchainNetwork: Joi.string().valid('ethereum', 'polygon', 'bsc').default('ethereum'),
});
