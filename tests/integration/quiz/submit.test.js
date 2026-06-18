/**
 * tests/integration/quiz/submit.test.js
 *
 * POST /api/v1/quizzes
 *
 * Covers:
 *  - Happy path: quiz created, fields persisted correctly
 *  - Missing required fields → 400
 *  - Missing difficulty → 400
 *  - Unauthenticated request → 401
 *  - Edge values: score=0, difficulty="hard", difficulty="any"
 */

const request = require('supertest');
const app = require('../../../src/app');
const { truncateTables } = require('../../helpers/db.helper');
const { QUIZ_PAYLOAD, registerAndLogin } = require('../../helpers/quiz.helper');

describe('POST /api/v1/quizzes', () => {
  let accessToken;

  beforeEach(async () => {
    await truncateTables();
    accessToken = await registerAndLogin();
  });

  it('should create a new quiz and return it with the correct fields', async () => {
    const response = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_PAYLOAD);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.difficulty).toBe('easy');
    expect(response.body.data.score).toBe(3);
    expect(response.body.data.total_questions).toBe(5);
  });

  it('should return 400 when required fields (score, time_taken) are missing', async () => {
    const response = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ difficulty: 'easy' }); // score, total_questions, time_taken missing

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when the difficulty field is missing', async () => {
    const response = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ total_questions: 5, score: 3, time_taken: 120, questions: [] });

    expect(response.status).toBe(400);
  });

  it('should return 401 when the request is not authenticated', async () => {
    const response = await request(app)
      .post('/api/v1/quizzes')
      .send(QUIZ_PAYLOAD);

    expect(response.status).toBe(401);
  });

  describe('edge values', () => {
    it('should accept a score of 0 (all questions answered incorrectly)', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...QUIZ_PAYLOAD, score: 0, difficulty: 'hard', total_questions: 10, time_taken: 300 });

      expect(response.status).toBe(201);
      expect(response.body.data.score).toBe(0);
    });

    it('should accept difficulty "hard"', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...QUIZ_PAYLOAD, difficulty: 'hard' });

      expect(response.status).toBe(201);
      expect(response.body.data.difficulty).toBe('hard');
    });

    it('should accept difficulty "any"', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...QUIZ_PAYLOAD, difficulty: 'any' });

      expect(response.status).toBe(201);
    });
  });
});
