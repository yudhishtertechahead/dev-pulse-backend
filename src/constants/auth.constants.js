/**
 * Centralized auth constants.
 * Import from here — never hard-code these strings elsewhere.
 */

/** Name of the httpOnly cookie that carries the refresh token */
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/** Reasons recorded when a session is revoked */
const REVOKE_REASON = Object.freeze({
  LOGOUT:              'logout',
  LOGOUT_ALL:          'logout_all',
  REUSE_DETECTED:      'reuse_detected',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
  ADMIN_REVOKED:       'admin_revoked',
});

/** User roles allowed in the system */
const USER_ROLE = Object.freeze({
  USER:  'user',
  ADMIN: 'admin',
});

module.exports = {
  REFRESH_TOKEN_COOKIE_NAME,
  REVOKE_REASON,
  USER_ROLE,
};
