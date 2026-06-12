const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

// Public routes
router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login',    validate(loginSchema),    ctrl.login);
router.post('/refresh',                            ctrl.refresh);
router.post('/logout',                             ctrl.logout);

// Protected routes
router.post('/logout-all', protect, ctrl.logoutAll);
router.get('/sessions',    protect, ctrl.getSessions);
router.get('/me',          protect, ctrl.getMe);

module.exports = router;