const { query } = require('../config/db');

const UserModel = {
  findAll: async () => {
    const { rows } = await query('SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC');
    return rows;
  },

  findById: async (id) => {
    const { rows } = await query('SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  findByEmail: async (email) => {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  create: async ({ name, email, password }) => {
    const { rows } = await query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role, is_active, created_at',
      [name, email, password]
    );
    return rows[0];
  },

  update: async (id, { name, email }) => {
    const { rows } = await query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, role, is_active, updated_at',
      [name, email, id]
    );
    return rows[0] || null;
  },

  deactivate: async (id) => {
    const { rows } = await query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  }
};

module.exports = UserModel;
