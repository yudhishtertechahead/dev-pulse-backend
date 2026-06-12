const createError = require('../utils/createError');

/**
 * Generic Joi validation middleware factory.
 *
 * Usage in routes:
 *   router.post('/register', validate(registerSchema), ctrl.register);
 *
 * Options chosen:
 *   abortEarly: false  → collect ALL errors, not just the first
 *   stripUnknown: true → silently drop fields not in the schema (safe default)
 *   convert: true      → coerce types (trim strings, lowercase email, etc.)
 *
 * On success:
 *   req.body is replaced with the sanitised Joi output (trimmed, lowercased, etc.)
 *   so controllers and services always receive clean data.
 *
 * On failure:
 *   Passes a 400 AppError to next() with all validation messages joined.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate req.body against
 * @param {'body'|'params'|'query'} [target='body'] - which part of req to validate
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message.replace(/"/g, "'")).join(', ');
    return next(createError(message, 400));
  }

  req[target] = value; // replace with sanitised value
  next();
};

module.exports = validate;
