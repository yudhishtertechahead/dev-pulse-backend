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
  },

  updatePassword: async (id, hashedPassword) => {
    const { rows } = await query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id',
      [hashedPassword, id]
    );
    return rows[0] || null;
  },

  // ── Admin extensions ────────────────────────────────────────────────────

  /**
   * Paginated user list with optional search/filter.
   * search: ILIKE on name or email
   * role: 'user' | 'admin'
   * status: 'active' | 'inactive'
   */
  findPaginated: async ({ page = 1, limit = 20, search = '', role = '', status = '' } = {}) => {
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (status === 'active') {
      conditions.push(`u.is_active = true`);
    } else if (status === 'inactive') {
      conditions.push(`u.is_active = false`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(safeLimit);
    params.push(offset);

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              COUNT(q.id)::int AS quiz_count
       FROM users u
       LEFT JOIN quizzes q ON q.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows;
  },

  /** Count matching users for pagination metadata */
  countByFilters: async ({ search = '', role = '', status = '' } = {}) => {
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (status === 'active') {
      conditions.push(`is_active = true`);
    } else if (status === 'inactive') {
      conditions.push(`is_active = false`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);
    return rows[0].total;
  },

  /** Promote or demote a user's role */
  updateRole: async (id, role) => {
    const { rows } = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role',
      [role, id]
    );
    return rows[0] || null;
  },

  /** Reactivate a previously deactivated account */
  activate: async (id) => {
    const { rows } = await query(
      'UPDATE users SET is_active = true WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = UserModel;
