const { query, pool } = require('../config/db');
const { buildQuizStatsFromRows } = require('../utils/quizStats.utils');

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
  },

  getStatsByUserId: async (user_id) => {
    const { rows } = await query(
      `SELECT id, score, total_questions, difficulty, time_taken, created_at
       FROM quizzes
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [user_id]
    );

    return buildQuizStatsFromRows(rows);
  },

  // ── Admin extensions ─────────────────────────────────────────────────────

  /** Platform-wide aggregate stats */
  getPlatformStats: async () => {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int                                                                    AS total_quizzes,
         ROUND(AVG(score::float / NULLIF(total_questions, 0) * 100)::numeric, 1)         AS avg_score_pct,
         ROUND(AVG(time_taken)::numeric, 0)::int                                         AS avg_time_seconds,
         COUNT(DISTINCT user_id)::int                                                    AS unique_players
       FROM quizzes`
    );
    const summary = rows[0];

    const { rows: byDiff } = await query(
      `SELECT difficulty,
              COUNT(*)::int                                                                    AS attempts,
              ROUND(AVG(score::float / NULLIF(total_questions, 0) * 100)::numeric, 1)         AS avg_score_pct
       FROM quizzes
       GROUP BY difficulty
       ORDER BY difficulty`
    );

    // signups trend (last 30 days) — joined here for the overview endpoint
    const { rows: signupsTrend } = await query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // quizzes per day (last 30 days)
    const { rows: quizTrend } = await query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
       FROM quizzes
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    return { summary, byDifficulty: byDiff, signupsTrend, quizTrend };
  },

  /** Recent quiz submissions across all users (for admin feed) */
  getRecentQuizzes: async (limit = 50, offset = 0) => {
    const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const { rows } = await query(
      `SELECT q.id, q.user_id, u.name AS user_name, u.email AS user_email,
              q.difficulty, q.score, q.total_questions, q.time_taken, q.created_at
       FROM quizzes q
       JOIN users u ON u.id = q.user_id
       ORDER BY q.created_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, parseInt(offset, 10) || 0]
    );
    return rows;
  },

  /** Count quizzes for a specific user */
  countByUserId: async (userId) => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM quizzes WHERE user_id = $1`,
      [userId]
    );
    return rows[0].count;
  },

  /** Top users by average score % (min N quizzes) */
  getLeaderboard: async (minQuizzes = 3, topN = 10) => {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email,
              COUNT(q.id)::int                                                                    AS quiz_count,
              ROUND(AVG(q.score::float / NULLIF(q.total_questions, 0) * 100)::numeric, 1)         AS avg_score_pct
       FROM quizzes q
       JOIN users u ON u.id = q.user_id
       GROUP BY u.id, u.name, u.email
       HAVING COUNT(q.id) >= $1
       ORDER BY avg_score_pct DESC
       LIMIT $2`,
      [minQuizzes, topN]
    );
    return rows;
  },
};

module.exports = QuizModel;
