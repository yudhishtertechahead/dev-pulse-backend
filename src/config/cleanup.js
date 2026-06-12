const { query } = require('./db');

/**
 * cleanupExpiredSessions — housekeeping job run every 6 hours.
 *
 * Deletes two categories of rows from the sessions table:
 *   1. Expired sessions    — refresh token has passed its expires_at
 *   2. Old revoked sessions — revoked more than 7 days ago (audit window)
 *
 * These rows can never be used again so there is no reason to keep them.
 */
async function cleanupExpiredSessions() {
  try {
    const result = await query(
      `DELETE FROM sessions
       WHERE expires_at < NOW()
          OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
    );
    if (result.rowCount > 0) {
      console.log(`[Cleanup] Removed ${result.rowCount} expired/old revoked sessions`);
    }
  } catch (err) {
    console.error('[Cleanup] Failed to clean sessions:', err.message);
  }
}

module.exports = cleanupExpiredSessions;
