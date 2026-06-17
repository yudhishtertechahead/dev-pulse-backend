const { query } = require('../config/db');

const PasswordResetModel = {
  create: async ({ userId, tokenHash, expiresAt }) => {
    const { rows } = await query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id, user_id, token_hash, expires_at',
      [userId, tokenHash, expiresAt]
    );
    return rows[0];
  },

  findByTokenHash: async (tokenHash) => {
    const { rows } = await query(
      'SELECT id, user_id, token_hash, expires_at FROM password_resets WHERE token_hash = $1',
      [tokenHash]
    );
    return rows[0] || null;
  },

  deleteByUserId: async (userId) => {
    await query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
  },

  deleteByTokenHash: async (tokenHash) => {
    await query('DELETE FROM password_resets WHERE token_hash = $1', [tokenHash]);
  }
};

module.exports = PasswordResetModel;
