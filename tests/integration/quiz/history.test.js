/**
 * tests/integration/quiz/history.test.js
 *
 * GET /api/v1/quizzes  (quiz history list)
 *
 * Covers:
 *  - Empty list when user has no quizzes
 *  - Returns quizzes after submission
 *  - Data isolation: user A cannot see user B's quizzes
 *  - Unauthenticated request → 401
 */

const request = require('supertest');
const app = require('../../../src/app');
const { truncateTables } = require('../../helpers/db.helper');
const { QUIZ_PAYLOAD, registerAndLogin } = require('../../helpers/quiz.helper');

describe('GET /api/v1/quizzes', () => {
  let accessToken;

  beforeEach(async () => {
    await truncateTables();
    accessToken = await registerAndLogin();
  });

  it('should return an empty array when the user has no quizzes yet', async () => {
    const response = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(0);
  });

  it('should return the quiz history after the user submits a quiz', async () => {
    await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_PAYLOAD);

    const response = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
  });

  it('should only return the authenticated user\'s own quizzes (data isolation)', async () => {
    // User A submits a quiz
    await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_PAYLOAD);

    // User B registers, logs in, and submits their own quiz
    const otherToken = await registerAndLogin({ name: 'Other', email: 'other@example.com' });
    await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...QUIZ_PAYLOAD, difficulty: 'hard' });

    // User A must only see their own quiz
    const response = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].difficulty).toBe('easy');
  });

  it('should return 401 without an access token', async () => {
    const response = await request(app).get('/api/v1/quizzes');
    expect(response.status).toBe(401);
  });
});
