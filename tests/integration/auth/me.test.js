/**
 * tests/integration/auth/me.test.js
 *
 * GET /api/v1/auth/me  (protected)
 *
 * Covers:
 *  - Happy path: returns user profile without exposing password
 *  - No token → 401
 *  - Malformed JWT → 401
 *  - Missing "Bearer" prefix → 401
 */

const request = require('supertest');
const app = require('../../../src/app');
const { truncateTables } = require('../../helpers/db.helper');
const { registerAndLogin } = require('../../helpers/auth.helper');

describe('GET /api/v1/auth/me', () => {
  let accessToken;

  beforeEach(async () => {
    await truncateTables();
    ({ accessToken } = await registerAndLogin());
  });

  it('should return the authenticated user profile', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('test@example.com');
    // Password must never be returned from the API
    expect(response.body.data.password).toBeUndefined();
  });

  it('should return 401 when no Authorization header is provided', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('should return 401 for a malformed / garbage JWT', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer this.is.junk');

    expect(response.status).toBe(401);
  });

  it('should return 401 when the "Bearer" prefix is missing', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', accessToken); // raw token, no scheme

    expect(response.status).toBe(401);
  });
});
