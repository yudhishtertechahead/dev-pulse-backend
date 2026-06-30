const AdminService = require('../services/admin.service');

// ── Overview ──────────────────────────────────────────────────────────────────

exports.getOverview = async (req, res, next) => {
  try {
    const data = await AdminService.getPlatformOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ── Users ─────────────────────────────────────────────────────────────────────

exports.listUsers = async (req, res, next) => {
  try {
    const result = await AdminService.listUsers(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getUserDetail = async (req, res, next) => {
  try {
    const data = await AdminService.getUserDetail(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const data = await AdminService.updateUser(req.params.id, req.body, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.deactivateUser = async (req, res, next) => {
  try {
    const data = await AdminService.deactivateUser(req.params.id, req.user);
    res.json({ success: true, data, message: 'User deactivated and all sessions revoked' });
  } catch (err) {
    next(err);
  }
};

exports.reactivateUser = async (req, res, next) => {
  try {
    const data = await AdminService.reactivateUser(req.params.id);
    res.json({ success: true, data, message: 'User reactivated' });
  } catch (err) {
    next(err);
  }
};

exports.getUserSessions = async (req, res, next) => {
  try {
    const data = await AdminService.getUserActiveSessions(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.forceLogoutUser = async (req, res, next) => {
  try {
    const data = await AdminService.forceLogoutUser(req.params.id);
    res.json({ success: true, data, message: 'All user sessions revoked' });
  } catch (err) {
    next(err);
  }
};

// ── Sessions ──────────────────────────────────────────────────────────────────

exports.listAllSessions = async (req, res, next) => {
  try {
    const result = await AdminService.listAllActiveSessions(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.revokeSession = async (req, res, next) => {
  try {
    const data = await AdminService.revokeSession(req.params.sessionId);
    res.json({ success: true, data, message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
};

// ── Quizzes ───────────────────────────────────────────────────────────────────

exports.getQuizStats = async (req, res, next) => {
  try {
    const data = await AdminService.getPlatformQuizStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getRecentQuizzes = async (req, res, next) => {
  try {
    const data = await AdminService.getRecentQuizzes(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
