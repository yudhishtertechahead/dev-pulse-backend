const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * ACCESS TOKEN payload: { userId, role, sessionId }
 *  - sessionId lets the auth middleware validate the session is still active
 *    WITHOUT waiting for the short-lived access token to expire naturally.
 *  - email is intentionally omitted — the middleware reads it from the DB
 *    session row, so there's no need to expose it in the token.
 */
function generateAccessToken({ userId, role, sessionId }) {
  return jwt.sign(
    { userId, role, sessionId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN }
  );
}

/**
 * REFRESH TOKEN payload: { userId, sessionId }
 *  - sessionId ties this refresh token to the exact session row so reuse detection
 *    can immediately find and revoke the correct session.
 */
function generateRefreshToken({ userId, sessionId }) {
  return jwt.sign(
    { userId, sessionId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * Store only the SHA-256 hash of a token, never the raw value.
 * Even if the DB is compromised, raw tokens cannot be recovered.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshTokenExpiry() {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const days = parseInt(expiresIn.replace('d', '')) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiry
};
