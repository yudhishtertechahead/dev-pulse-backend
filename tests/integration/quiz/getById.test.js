/**
 * tests/integration/quiz/getById.test.js
 *
 * GET /api/v1/quizzes/:id
 *
 * Covers:
 *  - Owner can access their own quiz → 200
 *  - Another user cannot access the quiz → 403
 *  - Valid UUID that doesn't exist → 404
 *  - Invalid UUID string (DB parse error) → 400 or 500 (graceful)
 *  - Unauthenticated request → 401
 */

const request = require('supertest');
const app = require('../../../src/app');
const { randomUUID } = require('crypto');
const { truncateTables } = require('../../helpers/db.helper');
const { QUIZ_PAYLOAD, registerAndLogin } = require('../../helpers/quiz.helper');

describe('GET /api/v1/quizzes/:id', () => {
  let accessToken;
  let otherUserToken;
  let quizId;

  beforeEach(async () => {
    await truncateTables();

    // Primary user: register, login, submit a quiz
    accessToken = await registerAndLogin();
    const submitRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_PAYLOAD);
    quizId = submitRes.body.data.id;

    // Second user (will try to access primary user's quiz)
    otherUserToken = await registerAndLogin({ name: 'Other User', email: 'other@example.com' });
  });

  it('should return the quiz details to the quiz owner', async () => {
    const response = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(quizId);
    expect(response.body.data.difficulty).toBe('easy');
  });

  it('should return 403 when another authenticated user tries to access the quiz', async () => {
    const response = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 for a valid UUID that does not belong to any quiz', async () => {
    const response = await request(app)
      .get(`/api/v1/quizzes/${randomUUID()}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it('should handle an invalid UUID string gracefully (returns 4xx or 5xx, not a crash)', async () => {
    const response = await request(app)
      .get('/api/v1/quizzes/this-is-not-a-uuid')
      .set('Authorization', `Bearer ${accessToken}`);

    // PostgreSQL throws a UUID parse error — we just ensure the app responds and doesn't hang
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should return 401 without an access token', async () => {
    const response = await request(app).get(`/api/v1/quizzes/${quizId}`);
    expect(response.status).toBe(401);
  });
});
