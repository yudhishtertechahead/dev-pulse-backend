const { pool } = require('../../src/config/db');

const truncateTables = async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Can only truncate tables in test environment');
  }

  // Be careful with foreign keys. TRUNCATE ... CASCADE helps clear related tables.
  await pool.query(`
    TRUNCATE TABLE 
      sessions,
      password_resets,
      quiz_questions,
      quizzes,
      users
    RESTART IDENTITY CASCADE;
  `);
};

module.exports = { truncateTables };
