const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const UserModel = require('../models/user.model');
const SessionModel = require('../models/session.model');
const PasswordResetModel = require('../models/password_reset.model');
const { sendEmail } = require('../utils/email');
const createError = require('../utils/createError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} = require('../utils/token.utils'); // generateRefreshToken & getRefreshTokenExpiry used in _issueSession
const {
  REFRESH_TOKEN_COOKIE_NAME,
  getCookieOptions,
  clearCookieOptions,
} = require('../utils/cookie.utils');
const { REVOKE_REASON } = require('../constants/auth.constants');

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Creates a new user account.
 * Production standard: registration ONLY persists the user record.
 * The client must call /login separately to obtain tokens.
 * This keeps registration side-effect-free and allows email verification
 * flows to be added without changing the token issuance path.
 *
 * @returns {object} Safe user object (no password field)
 */
async function registerUser({ name, email, password }) {
  const existing = await UserModel.findByEmail(email);
  if (existing) {
    throw createError('Email already in use', 409);
  }

  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await UserModel.create({ name, email, password: hashedPassword });

  // Never return the hashed password
  const { password: _, ...safeUser } = user;
  return safeUser;
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Validates credentials and, on success, issues a session with both tokens.
 *
 * @param {boolean} [body.rememberMe=false]
 *   true  → refresh token cookie persists for 7 days (same as token expiry)
 *   false → refresh token cookie is a session cookie (cleared when browser closes)
 *
 * @returns {{ accessToken: string }} — refresh token is set as a cookie on res
 */
async function loginUser({ email, password, rememberMe = false }, req, res) {
  const user = await UserModel.findByEmail(email);

  // Use a single generic message to prevent user-enumeration attacks
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw createError('Invalid credentials', 401);
  }

  if (!user.is_active) {
    throw createError('Account is deactivated', 403);
  }

  const accessToken = await _issueSession(user, req, res, rememberMe);
  return { accessToken };
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

/**
 * Issues a new access token using the existing refresh token (no rotation).
 *
 * Lookup strategy:
 *   We use SessionModel.findById(sessionId) — a PRIMARY KEY lookup — instead of
 *   searching by refresh_token_hash. This is faster because:
 *     • PK lookup = O(log n) B-tree seek on the clustered index.
 *     • After the lookup we still compare hashes to detect stale/stolen tokens.
 *
 * Security checks (in order):
 *   1. JWT signature + expiry  — proves token was issued by us and is fresh
 *   2. Session exists          — sessionId is valid and in the DB
 *   3. revoked_at IS NULL      — session was not explicitly revoked (logout / admin)
 *   4. Hash comparison         — incoming token matches the stored hash;
 *                                a mismatch means a tampered/unknown token →
 *                                nuclear option: revoke ALL sessions
 *   5. Expiry (belt+braces)    — DB-level expiry cross-check
 *   6. Account active          — user hasn't been deactivated
 *
 * The refresh token is NOT rotated — the same token remains valid until it
 * expires or is explicitly revoked (logout). Only the access token is reissued.
 *
 * @returns {{ accessToken: string }}
 */
async function refreshTokens(rawRefreshToken, req, res) {
  // 1. Verify JWT signature + expiry
  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw createError('Invalid or expired refresh token', 401);
  }

  const { userId, sessionId } = decoded;

  // 2. PK lookup — fastest possible DB read
  const session = await SessionModel.findById(sessionId);

  if (!session) {
    throw createError('Session not found. Please log in again.', 401);
  }

  // 3. Explicitly revoked session (logout / admin action)
  if (session.revoked_at !== null) {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearCookieOptions());
    throw createError('Session has been revoked. Please log in again.', 401);
  }

  // 4. Hash comparison — catches tampered or unknown tokens
  if (session.refresh_token_hash !== hashToken(rawRefreshToken)) {
    await SessionModel.revokeAllByUserId(userId, REVOKE_REASON.REUSE_DETECTED);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearCookieOptions());
    throw createError('Invalid refresh token. All sessions revoked.', 401);
  }

  // 5. Expiry check (belt + braces — JWT.verify already checks this)
  if (new Date(session.expires_at) < new Date()) {
    throw createError('Refresh token expired', 401);
  }

  // 6. Account still active
  if (!session.is_active) {
    throw createError('Account is deactivated', 403);
  }

  // Issue new access token — refresh token and session row are left unchanged
  // Always read role from DB session row (session.role), not from the JWT payload,
  // because the refresh token was issued without a role field (or with a stale one).
  const newAccessToken = generateAccessToken({
    userId,
    role: session.role,
    sessionId,
  });

  return { accessToken: newAccessToken };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Revokes the current session identified by the refresh token cookie.
 *
 * We decode the token leniently (ignoring expiry) so that a user whose
 * access token has already expired can still cleanly log out.
 * We look up by sessionId (PK) — no hash-column scan needed.
 */
async function logoutUser(rawRefreshToken, res) {
  if (rawRefreshToken) {
    try {
      // Decode without throwing on expiry — we just need the sessionId
      const decoded = verifyRefreshToken(rawRefreshToken);
      const { sessionId } = decoded;

      const session = await SessionModel.findById(sessionId);
      if (session && session.revoked_at === null) {
        await SessionModel.revokeOne(session.id, REVOKE_REASON.LOGOUT);
      }
    } catch {
      // Token is malformed or invalid signature — nothing to revoke, just clear cookie
    }
  }
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearCookieOptions());
}

/**
 * Revokes ALL active sessions for the authenticated user.
 */
async function logoutAllSessions(userId, res) {
  await SessionModel.revokeAllByUserId(userId, REVOKE_REASON.LOGOUT_ALL);
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearCookieOptions());
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

/**
 * Initiates the password reset flow.
 */
async function forgotPassword({ email }) {
  const user = await UserModel.findByEmail(email);
  if (!user || !user.is_active) {
    // In development mode, give a clear error so it's easier to test
    if (process.env.NODE_ENV !== 'production') {
      throw createError(`User with email ${email} not found (Dev Mode only message)`, 404);
    }
    // Return success to prevent email enumeration attacks in production
    return { message: 'If that email address is in our database, we will send you an email to reset your password.' };
  }

  // Delete any existing reset tokens for this user
  await PasswordResetModel.deleteByUserId(user.id);

  // Generate a reset token
  const resetToken = randomUUID();
  const tokenHash = hashToken(resetToken);
  
  // Set expiry to 1 hour from now
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await PasswordResetModel.create({
    userId: user.id,
    tokenHash,
    expiresAt
  });

  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

  // In development mode, print the link directly to the terminal for easy testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n\n=============================================================');
    console.log('🚧 DEV MODE: Password Reset Link generated:');
    console.log(resetLink);
    console.log('=============================================================\n\n');
  }

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>You requested to reset your password.</p>
      <p>Click the link below to set a new password. This link will expire in 1 hour.</p>
      <a href="${resetLink}">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `
  });

  return { message: 'If that email address is in our database, we will send you an email to reset your password.' };
}

// ─── Reset Password ──────────────────────────────────────────────────────────

async function resetPassword({ email, token, newPassword }, res) {
  const user = await UserModel.findByEmail(email);
  if (!user || !user.is_active) {
    throw createError('Invalid token or email', 400);
  }

  const tokenHash = hashToken(token);
  const resetRecord = await PasswordResetModel.findByTokenHash(tokenHash);

  if (!resetRecord || resetRecord.user_id !== user.id) {
    throw createError('Invalid or expired password reset token', 400);
  }

  if (new Date(resetRecord.expires_at) < new Date()) {
    await PasswordResetModel.deleteByTokenHash(tokenHash);
    throw createError('Password reset token has expired', 400);
  }

  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  await UserModel.updatePassword(user.id, hashedPassword);
  await PasswordResetModel.deleteByTokenHash(tokenHash);

  // Revoke all sessions to force the user to log in again
  await logoutAllSessions(user.id, res);

  return { message: 'Password has been successfully reset. Please log in with your new password.' };
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

/**
 * Returns all sessions for a user, flagging the current one.
 */
async function getUserSessions(userId, currentSessionId) {
  const sessions = await SessionModel.findAllByUserId(userId);
  return sessions.map(s => ({ ...s, isCurrent: s.id === currentSessionId }));
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Creates a new session row and issues both tokens.
 *
 * The key insight: we pre-generate the sessionId in application code so we
 * can embed it in BOTH tokens before hitting the DB.
 *
 *   sessionId ──► embedded in access token  { userId, email, role, sessionId }
 *             ──► embedded in refresh token { userId, sessionId }
 *             ──► stored as PK in sessions table
 *
 * This means the auth middleware can verify the access token and immediately
 * look up the session row by sessionId to confirm it's still active.
 *
 * @private
 * @param {boolean} [rememberMe=false] Passed through to getCookieOptions.
 * @returns {string} Raw access token
 */
async function _issueSession(user, req, res, rememberMe = false) {
  const sessionId = randomUUID();
  const deviceInfo = req.headers['user-agent'] || 'unknown';
  const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
  const expiresAt = getRefreshTokenExpiry();

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
    sessionId,
  });

  const refreshToken = generateRefreshToken({ userId: user.id, sessionId });
  const refreshTokenHash = hashToken(refreshToken);

  await SessionModel.createWithId({
    id: sessionId,
    userId: user.id,
    refreshTokenHash,
    deviceInfo,
    ipAddress,
    expiresAt,
  });

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getCookieOptions(rememberMe));

  return accessToken;
}

module.exports = {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  logoutAllSessions,
  getUserSessions,
  forgotPassword,
  resetPassword,
};
