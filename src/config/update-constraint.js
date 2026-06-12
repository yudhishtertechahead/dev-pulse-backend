require('dotenv').config();
const { pool } = require('./db');

async function updateConstraint() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE quizzes DROP CONSTRAINT quizzes_difficulty_check;');
    await client.query("ALTER TABLE quizzes ADD CONSTRAINT quizzes_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard', 'any'));");
    await client.query('COMMIT');
    console.log('Constraint updated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating constraint:', err);
  } finally {
    client.release();
    pool.end();
  }
}

updateConstraint();
