/**
 * tests/integration/auth/logout.test.js
 *
 * POST /api/v1/auth/logout
 * POST /api/v1/auth/logout-all  (protected)
 *
 * Covers:
 *  - Logout: revokes the session — subsequent refresh returns 401
 *  - Logout: graceful 200 when no cookie is present
 *  - Logout-all: revokes every session so refresh returns 401
 *  - Logout-all: 401 when called without an access token
 */

const request = require('supertest');
const app = require('../../../src/app');
const { truncateTables } = require('../../helpers/db.helper');
const { registerAndLogin } = require('../../helpers/auth.helper');

describe('POST /api/v1/auth/logout', () => {
  let refreshTokenCookie;

  beforeEach(async () => {
    await truncateTables();
    ({ refreshTokenCookie } = await registerAndLogin());
  });

  it('should logout and revoke the session so a subsequent refresh fails', async () => {
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshTokenCookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // The now-revoked refresh token must be rejected
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(refreshRes.status).toBe(401);
  });

  it('should return 200 even when no refresh cookie is provided (graceful no-op)', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    expect(response.status).toBe(200);
  });
});

describe('POST /api/v1/auth/logout-all', () => {
  let accessToken;
  let refreshTokenCookie;

  beforeEach(async () => {
    await truncateTables();
    ({ accessToken, refreshTokenCookie } = await registerAndLogin());
  });

  it('should revoke all sessions so any existing refresh token is rejected', async () => {
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutAllRes.status).toBe(200);
    expect(logoutAllRes.body.success).toBe(true);

    // Existing refresh cookie must now be invalid
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(refreshRes.status).toBe(401);
  });

  it('should return 401 when called without a valid access token', async () => {
    const response = await request(app).post('/api/v1/auth/logout-all');
    expect(response.status).toBe(401);
  });
});
