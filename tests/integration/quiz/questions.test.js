/**
 * tests/integration/quiz/questions.test.js
 *
 * Quiz questions — DB transaction tests [P1]
 *
 * Covers:
 *  - Questions are persisted and returned with GET /quizzes/:id
 *  - is_correct=false stored correctly for wrong answers
 *  - score, total_questions, time_taken stored correctly on the parent quiz row
 *  - Transaction rollback: quiz row is not persisted if a question insert fails
 */

const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/db');
const { truncateTables } = require('../../helpers/db.helper');
const { registerAndLogin } = require('../../helpers/quiz.helper');

/** A quiz payload with 3 questions including one intentionally wrong answer. */
const QUIZ_WITH_QUESTIONS = {
  difficulty: 'medium',
  total_questions: 3,
  score: 2,
  time_taken: 90,
  questions: [
    {
      question: 'What is 2 + 2?',
      options: ['1', '2', '3', '4'],
      selectedOption: '4',
      correctOption: '4',
      isCorrect: true,
    },
    {
      question: 'What is the capital of France?',
      options: ['Berlin', 'Paris', 'Rome', 'Madrid'],
      selectedOption: 'Paris',
      correctOption: 'Paris',
      isCorrect: true,
    },
    {
      question: 'What is 5 x 5?',
      options: ['10', '20', '25', '30'],
      selectedOption: '20',  // wrong answer
      correctOption: '25',
      isCorrect: false,
    },
  ],
};

describe('Quiz Questions — DB Transaction', () => {
  let accessToken;

  beforeEach(async () => {
    await truncateTables();
    accessToken = await registerAndLogin();
  });

  it('should persist all questions and return them on GET /quizzes/:id', async () => {
    const submitRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_WITH_QUESTIONS);

    expect(submitRes.status).toBe(201);
    const quizId = submitRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.data.questions)).toBe(true);
    expect(getRes.body.data.questions.length).toBe(3);

    // Spot-check a specific question
    const q = getRes.body.data.questions.find((q) => q.question === 'What is 2 + 2?');
    expect(q).toBeDefined();
    expect(q.is_correct).toBe(true);
    expect(q.correct_option).toBe('4');
  });

  it('should store is_correct=false and the selected/correct options for a wrong answer', async () => {
    const submitRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_WITH_QUESTIONS);
    const quizId = submitRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const wrongAnswer = getRes.body.data.questions.find(
      (q) => q.question === 'What is 5 x 5?'
    );
    expect(wrongAnswer).toBeDefined();
    expect(wrongAnswer.is_correct).toBe(false);
    expect(wrongAnswer.selected_option).toBe('20');
    expect(wrongAnswer.correct_option).toBe('25');
  });

  it('should store quiz-level score, total_questions, and time_taken correctly', async () => {
    const submitRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(QUIZ_WITH_QUESTIONS);

    expect(submitRes.body.data.score).toBe(2);
    expect(submitRes.body.data.total_questions).toBe(3);
    expect(submitRes.body.data.time_taken).toBe(90);
  });

  it('should roll back the entire transaction if a question violates a DB constraint', async () => {
    const badPayload = {
      difficulty: 'easy',
      total_questions: 1,
      score: 0,
      time_taken: 10,
      questions: [
        {
          question: 'Bad question',
          options: [],
          selectedOption: null,
          correctOption: null, // NOT NULL in schema — triggers constraint violation
          isCorrect: false,
        },
      ],
    };

    const response = await request(app)
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(badPayload);

    // The insert should fail (DB constraint)
    expect(response.status).toBeGreaterThanOrEqual(400);

    // Because of ROLLBACK, no quiz row should exist in the DB
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM quizzes WHERE difficulty = 'easy'`
    );
    expect(Number(rows[0].count)).toBe(0);
  });
});
