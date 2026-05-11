import { sendValidationError } from '../utils/response.js';

export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => d.message.replace(/['"]/g, ''));
      return sendValidationError(res, errors);
    }

    req[target] = value;
    next();
  };
}
