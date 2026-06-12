const { query, pool } = require('../config/db');

const QuizModel = {
  createQuiz: async ({ user_id, difficulty, score, total_questions, time_taken, questions }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const quizRes = await client.query(
        `INSERT INTO quizzes (user_id, difficulty, score, total_questions, time_taken) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [user_id, difficulty, score, total_questions, time_taken]
      );
      const newQuiz = quizRes.rows[0];

      if (questions && questions.length > 0) {
        for (const q of questions) {
          await client.query(
            `INSERT INTO quiz_questions (quiz_id, question, options, selected_option, correct_option, is_correct)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [newQuiz.id, q.question, JSON.stringify(q.options || []), q.selectedOption, q.correctOption, q.isCorrect]
          );
        }
      }

      await client.query('COMMIT');
      return newQuiz;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  findByUserId: async (user_id) => {
    const { rows } = await query(
      `SELECT * FROM quizzes WHERE user_id = $1 ORDER BY created_at DESC`,
      [user_id]
    );
    return rows;
  },

  findById: async (id) => {
    const { rows } = await query(
      `SELECT * FROM quizzes WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return null;
    
    const quiz = rows[0];
    const qRows = await query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1`,
      [id]
    );
    quiz.questions = qRows.rows;
    return quiz;
  }
};

module.exports = QuizModel;
