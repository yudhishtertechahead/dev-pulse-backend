const { verifyAccessToken } = require('../utils/token.utils');
const SessionModel = require('../models/session.model');
const createError = require('../utils/createError');

/**
 * protect — verifies the access token then validates the DB session row.
 *
 * Flow:
 *   1. Extract Bearer token from Authorization header
 *   2. JWT verify → decode { userId, role, sessionId }
 *   3. SessionModel.findById(sessionId) — one DB query, joined with users
 *      Confirms: session exists, revoked_at IS NULL, refresh_token_hash present,
 *                user.is_active = true
 *   4. Attach req.user = { id, email, role, name, sessionId }
 *      (email/name come from the DB session row, not the token payload)
 *
 * Why check the session on every request?
 *   Without this, a logged-out or deactivated account remains valid until the
 *   short-lived access token expires naturally. Session-row validation gives us
 *   true server-side instant revocation.
 *
 *   Trade-off: +1 DB query per request. At scale, cache session rows in Redis
 *   with a TTL matching the access token lifetime.
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(createError('No token provided', 401));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(createError('Invalid or expired access token', 401));
    }

    const { userId, sessionId, role } = decoded;

    req.user = {
      id: userId,
      sessionId,
      role,
    };

    next();
  } catch (err) {
    next(err);
  }
};

exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(createError('You do not have permission to perform this action', 403));
  }
  next();
};
