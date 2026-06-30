const express = require('express');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/admin.controller');

const router = express.Router();

// All admin routes require a valid session AND admin role.
// This router-level middleware applies to every route below.
router.use(protect, restrictTo('admin'));

// ── Platform Overview ─────────────────────────────────────────────────────────
router.get('/overview', ctrl.getOverview);

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users', ctrl.listUsers);
router.get('/users/:id', ctrl.getUserDetail);
router.patch('/users/:id', ctrl.updateUser);
router.post('/users/:id/deactivate', ctrl.deactivateUser);
router.post('/users/:id/reactivate', ctrl.reactivateUser);
router.get('/users/:id/sessions', ctrl.getUserSessions);
router.delete('/users/:id/sessions', ctrl.forceLogoutUser);

// ── Session Management ────────────────────────────────────────────────────────
router.get('/sessions', ctrl.listAllSessions);
router.delete('/sessions/:sessionId', ctrl.revokeSession);

// ── Quiz Analytics ────────────────────────────────────────────────────────────
router.get('/quizzes/stats', ctrl.getQuizStats);
router.get('/quizzes/recent', ctrl.getRecentQuizzes);

module.exports = router;
