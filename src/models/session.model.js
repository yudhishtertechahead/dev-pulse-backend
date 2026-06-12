const { query } = require('../config/db');

/**
 * Sessions table schema (see migrate.js):
 *
 *   id                 UUID PRIMARY KEY   — this IS the session_id, embedded in tokens
 *   user_id            UUID FK            — the owner
 *   refresh_token_hash VARCHAR(255) UNIQUE — SHA-256 of raw refresh token (never store raw)
 *                                           Set to NULL when the session is revoked/logged out.
 *                                           This is an independent guard alongside revoked_at.
 *   device_info        VARCHAR(255)       — user-agent
 *   ip_address         VARCHAR(45)        — client IP (supports IPv6)
 *   expires_at         TIMESTAMPTZ        — refresh token expiry
 *   created_at         TIMESTAMPTZ
 *   revoked_at         TIMESTAMPTZ        — NULL = active; non-NULL = revoked/logged out
 *   revoked_reason     VARCHAR(50)        — 'logout' | 'logout_all' | 'reuse_detected'
 */
const SessionModel = {

  /**
   * Create a session with a pre-generated id.
   * We pre-generate the UUID in the application layer so we can embed
   * the sessionId into the JWT payload BEFORE hitting the DB.
   */
  createWithId: async ({ id, userId, refreshTokenHash, deviceInfo, ipAddress, expiresAt }) => {
    const { rows } = await query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, userId, refreshTokenHash, deviceInfo, ipAddress, expiresAt]
    );
    return rows[0];
  },

  /**
   * Find a session by its PK (session_id).
   * Used by auth middleware: verifies access token → extracts sessionId → calls this.
   * The JOIN check confirms the user is still active in one query.
   */
  findById: async (sessionId) => {
    const { rows } = await query(
      `SELECT s.*, u.is_active, u.role, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [sessionId]
    );
    return rows[0] || null;
  },

  /**
   * Find a session by the hashed refresh token.
   * Used by: /refresh endpoint, /logout endpoint.
   */
  findByRefreshTokenHash: async (refreshTokenHash) => {
    const { rows } = await query(
      `SELECT s.*, u.is_active, u.role, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1`,
      [refreshTokenHash]
    );
    return rows[0] || null;
  },

  /** All sessions for a user — used by GET /auth/sessions */
  findAllByUserId: async (userId) => {
    const { rows } = await query(
      `SELECT id, device_info, ip_address, created_at, expires_at, revoked_at, revoked_reason
       FROM sessions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Rotate the refresh token on an EXISTING session (same session_id).
   * Called during /refresh — the session identity persists across rotations
   * so you can track a device's lifetime session.
   */
  rotateRefreshToken: async (sessionId, newRefreshTokenHash, newExpiresAt) => {
    const { rows } = await query(
      `UPDATE sessions
       SET refresh_token_hash = $2, expires_at = $3
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id`,
      [sessionId, newRefreshTokenHash, newExpiresAt]
    );
    return rows[0] || null;
  },

  /**
   * Revoke a single session.
   * Nulls refresh_token_hash in addition to setting revoked_at — two independent
   * guards ensure the session cannot be used even if one check has a code bug.
   */
  revokeOne: async (sessionId, reason = 'logout') => {
    const { rows } = await query(
      `UPDATE sessions
       SET revoked_at = NOW(), revoked_reason = $2, refresh_token_hash = NULL
       WHERE id = $1
       RETURNING id`,
      [sessionId, reason]
    );
    return rows[0] || null;
  },

  /**
   * Revoke ALL active sessions for a user (logout-all / reuse-detected).
   * Also nulls refresh_token_hash on every affected row.
   */
  revokeAllByUserId: async (userId, reason = 'logout_all') => {
    const { rows } = await query(
      `UPDATE sessions
       SET revoked_at = NOW(), revoked_reason = $2, refresh_token_hash = NULL
       WHERE user_id = $1 AND revoked_at IS NULL
       RETURNING id`,
      [userId, reason]
    );
    return rows;
  },

  /** Housekeeping: delete rows whose refresh token has expired */
  deleteExpired: async () => {
    await query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  }
};

module.exports = SessionModel;
