/**
 * tests/integration/auth/refresh.test.js
 *
 * POST /api/v1/auth/refresh
 *
 * Covers:
 *  - Happy path: valid refresh cookie → new accessToken issued
 *  - No cookie → 401
 *  - Tampered / invalid JWT in cookie → 401
 *  - DB-level session expiry guard (belt-and-braces) → 401
 */

const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/db');
const { truncateTables } = require('../../helpers/db.helper');
const { registerAndLogin } = require('../../helpers/auth.helper');

describe('POST /api/v1/auth/refresh', () => {
  let refreshTokenCookie;

  beforeEach(async () => {
    await truncateTables();
    ({ refreshTokenCookie } = await registerAndLogin());
  });

  it('should issue a new accessToken when a valid refresh cookie is provided', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeDefined();
  });

  it('should return 401 when no refresh cookie is provided', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');
    expect(response.status).toBe(401);
  });

  it('should return 401 for a tampered / invalid refresh token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=totally.invalid.jwt');

    expect(response.status).toBe(401);
  });

  describe('DB-level session expiry guard', () => {
    it('should return 401 when the session is expired in the DB (even if JWT is still valid)', async () => {
      // Manually back-date the session's expires_at to the past
      await pool.query(
        `UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE revoked_at IS NULL`
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshTokenCookie);

      // JWT clock expiry hasn't fired (tokens are 15min), but the DB guard catches it
      expect(response.status).toBe(401);
    });
  });
});
