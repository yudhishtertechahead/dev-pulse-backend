/**
 * tests/helpers/quiz.helper.js
 *
 * Shared payloads and utilities for quiz integration tests.
 */

const request = require('supertest');
const app = require('../../src/app');

const USER_PAYLOAD = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Password@123',
  confirmPassword: 'Password@123',
};

/** Default minimal quiz payload (empty questions array). */
const QUIZ_PAYLOAD = {
  difficulty: 'easy',
  total_questions: 5,
  score: 3,
  time_taken: 120,
  questions: [],
};

/**
 * Registers a user and logs them in.
 * Returns the raw accessToken string.
 *
 * @param {object} overrides - Partial override for USER_PAYLOAD fields.
 */
async function registerAndLogin(overrides = {}) {
  const payload = { ...USER_PAYLOAD, ...overrides };
  await request(app).post('/api/v1/auth/register').send(payload);
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: payload.email, password: payload.password });
  return loginRes.body.accessToken;
}

module.exports = { USER_PAYLOAD, QUIZ_PAYLOAD, registerAndLogin };
