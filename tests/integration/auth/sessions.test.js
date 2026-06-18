/**
 * tests/integration/auth/sessions.test.js
 *
 * GET /api/v1/auth/sessions  (protected)
 *
 * Covers:
 *  - Returns active sessions list with isCurrent flag set on the calling session
 *  - 401 when no access token is provided
 */

const request = require('supertest');
const app = require('../../../src/app');
const { truncateTables } = require('../../helpers/db.helper');
const { registerAndLogin } = require('../../helpers/auth.helper');

describe('GET /api/v1/auth/sessions', () => {
  let accessToken;

  beforeEach(async () => {
    await truncateTables();
    ({ accessToken } = await registerAndLogin());
  });

  it('should return the list of active sessions with the current session flagged', async () => {
    const response = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);

    // The session used to make this request should be marked as current
    const currentSession = response.body.data.find((s) => s.isCurrent);
    expect(currentSession).toBeDefined();
  });

  it('should return 401 when no access token is provided', async () => {
    const response = await request(app).get('/api/v1/auth/sessions');
    expect(response.status).toBe(401);
  });
});
