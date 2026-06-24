const express = require('express');
const { submitContact } = require('../controllers/contact.controller');
const { validateContactForm } = require('../validators/contact.validator');

const router = express.Router();

// The rate limit can be handled globally or we can let app.js handle it
router.post('/', validateContactForm, submitContact);

module.exports = router;
