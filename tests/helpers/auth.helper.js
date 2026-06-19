/**
 * tests/helpers/auth.helper.js
 *
 * Shared utilities for auth integration tests.
 * Centralises registerAndLogin so every test file doesn't re-define it.
 */

const request = require('supertest');
const app = require('../../src/app');

/** Default user used across auth tests unless overridden. */
const REGISTER_PAYLOAD = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Password@123',
  confirmPassword: 'Password@123',
};

/**
 * Registers a user (if not already registered) and logs them in.
 * Returns { accessToken, refreshTokenCookie }.
 *
 * @param {object} overrides - Partial override of REGISTER_PAYLOAD fields.
 */
async function registerAndLogin(overrides = {}) {
  const payload = { ...REGISTER_PAYLOAD, ...overrides };
  await request(app).post('/api/v1/auth/register').send(payload);

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: payload.email, password: payload.password });

  const cookies = loginRes.headers['set-cookie'] || [];
  const refreshTokenCookie =
    cookies.find((c) => c.startsWith('refreshToken=')) || '';

  return {
    accessToken: loginRes.body.accessToken,
    refreshTokenCookie,
  };
}

module.exports = { REGISTER_PAYLOAD, registerAndLogin };
