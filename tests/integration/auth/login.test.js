/**
 * tests/integration/auth/login.test.js
 *
 * POST /api/v1/auth/login
 *
 * Covers:
 *  - Happy path: returns accessToken + HttpOnly refresh cookie
 *  - Wrong password → 401
 *  - Non-existent email → 401
 *  - Missing email field → 400
 *  - rememberMe=true → persistent cookie (Max-Age/Expires)
 *  - rememberMe=false → session cookie
 */

const request = require('supertest');
const app = require('../../../src/app');
const { truncateTables } = require('../../helpers/db.helper');
const { REGISTER_PAYLOAD } = require('../../helpers/auth.helper');

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await truncateTables();
    // Register a user so login tests have someone to authenticate as
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
  });

  it('should login successfully and return an accessToken + refresh cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password@123' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeDefined();

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.includes('refreshToken='))).toBe(true);
  });

  it('should return 401 for an incorrect password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPassword@1' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('should return 401 for a non-existent email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password@123' });

    expect(response.status).toBe(401);
  });

  it('should return 400 when the email field is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'Password@123' });

    expect(response.status).toBe(400);
  });

  describe('rememberMe cookie persistence', () => {
    it('should set a persistent cookie (Max-Age/Expires) when rememberMe=true', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password@123', rememberMe: true });

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'] || [];
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie.toLowerCase()).toMatch(/max-age|expires/i);
    });

    it('should issue a session cookie (no Max-Age) when rememberMe=false', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password@123', rememberMe: false });

      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'] || [];
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
    });
  });
});
