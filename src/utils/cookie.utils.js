const { REFRESH_TOKEN_COOKIE_NAME } = require('../constants/auth.constants');

/**
 * Builds cookie options for the refresh token.
 *
 * @param {boolean} [rememberMe=false]
 *   true  → persistent cookie, maxAge = 7 days (matches refresh token expiry)
 *   false → session cookie, no maxAge (browser clears it on close)
 */
function getCookieOptions(rememberMe = false) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  };

  if (rememberMe) {
    base.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  }

  return base;
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 0,
    expires: new Date(0),
  };
}

module.exports = {
  REFRESH_TOKEN_COOKIE_NAME,
  getCookieOptions,
  clearCookieOptions,
};
