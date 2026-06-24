const Joi = require('joi');

const validateContactForm = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().required().messages({
      'string.empty': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Enter a valid email address'
    }),
    message: Joi.string().trim().min(20).required().messages({
      'string.empty': 'Message is required',
      'string.min': 'Message must be at least 20 characters'
    })
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(err => err.message).join(', ');
    return res.status(400).json({ success: false, error: errors });
  }
  
  next();
};

module.exports = { validateContactForm };
