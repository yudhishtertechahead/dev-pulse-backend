const AuthService = require('../services/auth.service');
const { REFRESH_TOKEN_COOKIE_NAME } = require('../constants/auth.constants');
const UserModel = require('../models/user.model');

/**
 * Auth Controller — pure HTTP layer.
 *
 * By the time any handler runs:
 *   - req.body has been validated & sanitised by Joi (via validate middleware)
 *   - req.user has been populated by the protect middleware (on protected routes)
 *
 * Pattern: parse req → call service → send res. Nothing else.
 */

// POST /auth/register
exports.register = async (req, res, next) => {
  try {
    const user = await AuthService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: 'Account created. Please log in.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// POST /auth/login
exports.login = async (req, res, next) => {
  try {
    const { accessToken } = await AuthService.loginUser(req.body, req, res);
    res.status(200).json({ success: true, accessToken });
  } catch (err) {
    next(err);
  }
};

// POST /auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];
    const { accessToken } = await AuthService.refreshTokens(rawRefreshToken, req, res);
    res.status(200).json({ success: true, accessToken });
  } catch (err) {
    next(err);
  }
};

// POST /auth/logout
exports.logout = async (req, res, next) => {
  try {
    await AuthService.logoutUser(req.cookies[REFRESH_TOKEN_COOKIE_NAME], res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /auth/logout-all  [protected]
exports.logoutAll = async (req, res, next) => {
  try {
    await AuthService.logoutAllSessions(req.user.id, res);
    res.status(200).json({ success: true, message: 'Logged out from all sessions' });
  } catch (err) {
    next(err);
  }
};

// GET /auth/sessions  [protected]
exports.getSessions = async (req, res, next) => {
  try {
    const sessions = await AuthService.getUserSessions(req.user.id, req.user.sessionId);
    res.status(200).json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    next(err);
  }
};

// GET /auth/me  [protected]
exports.getMe = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
