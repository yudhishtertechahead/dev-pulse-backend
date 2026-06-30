const UserModel = require('../models/user.model');
const QuizModel = require('../models/quiz.model');
const SessionModel = require('../models/session.model');
const createError = require('../utils/createError');
const { query } = require('../config/db');

// ── Overview ──────────────────────────────────────────────────────────────────

/**
 * Platform KPIs + chart series for the admin overview dashboard.
 * Runs several aggregate queries in parallel for speed.
 */
async function getPlatformOverview() {
  const [
    usersRow,
    activeUsersRow,
    activeSessionsRow,
    quizStats,
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM users`),
    query(
      `SELECT COUNT(DISTINCT user_id)::int AS active_users_7d
       FROM quizzes
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    ),
    query(
      `SELECT COUNT(*)::int AS active_sessions
       FROM sessions
       WHERE revoked_at IS NULL AND expires_at > NOW()`
    ),
    QuizModel.getPlatformStats(),
  ]);

  // quizzes in last 7d / all-time
  const { rows: quizCounts } = await query(
    `SELECT
       COUNT(*)::int AS total_quizzes,
       COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int AS quizzes_7d
     FROM quizzes`
  );

  return {
    kpis: {
      totalUsers:     usersRow.rows[0].total,
      activeUsers7d:  activeUsersRow.rows[0].active_users_7d,
      activeSessions: activeSessionsRow.rows[0].active_sessions,
      totalQuizzes:   quizCounts[0].total_quizzes,
      quizzes7d:      quizCounts[0].quizzes_7d,
      avgScorePct:    Number(quizStats.summary.avg_score_pct ?? 0),
    },
    charts: {
      signupsTrend:  quizStats.signupsTrend,
      quizTrend:     quizStats.quizTrend,
      difficultyMix: quizStats.byDifficulty,
    },
  };
}

// ── User Management ───────────────────────────────────────────────────────────

async function listUsers(queryParams) {
  const { page, limit, search, role, status } = queryParams;
  const filters = { page, limit, search, role, status };

  const [users, total] = await Promise.all([
    UserModel.findPaginated(filters),
    UserModel.countByFilters({ search, role, status }),
  ]);

  const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);

  return {
    users,
    pagination: {
      total,
      page: parseInt(page, 10) || 1,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

async function getUserDetail(id) {
  const user = await UserModel.findById(id);
  if (!user) throw createError('User not found', 404);

  const [quizCount, activeSessions] = await Promise.all([
    QuizModel.countByUserId(id),
    query(
      `SELECT id, device_info, ip_address, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [id]
    ),
  ]);

  // Quick quiz summary
  const quizRows = await QuizModel.findByUserId(id);
  const totalScore = quizRows.reduce((s, q) => s + (q.score / q.total_questions) * 100, 0);
  const avgScore = quizRows.length ? Math.round(totalScore / quizRows.length) : 0;

  return {
    user,
    stats: {
      quizCount,
      avgScorePct: avgScore,
      activeSessionCount: activeSessions.rows.length,
    },
    activeSessions: activeSessions.rows,
  };
}

/**
 * Update name and/or role for a user.
 * Safeguards:
 *   - Admin cannot change their own role.
 *   - Cannot demote the last remaining admin.
 */
async function updateUser(id, { role, name }, adminUser) {
  const target = await UserModel.findById(id);
  if (!target) throw createError('User not found', 404);

  if (role !== undefined) {
    if (id === adminUser.id) {
      throw createError('You cannot change your own role', 403);
    }
    if (role === 'user' && target.role === 'admin') {
      // Ensure at least one admin remains
      const { rows } = await query(
        `SELECT COUNT(*)::int AS admin_count FROM users WHERE role = 'admin' AND is_active = true`
      );
      if (rows[0].admin_count <= 1) {
        throw createError('Cannot demote the last admin account', 400);
      }
    }
    await UserModel.updateRole(id, role);
  }

  if (name !== undefined) {
    await query('UPDATE users SET name = $1 WHERE id = $2', [name, id]);
  }

  return UserModel.findById(id);
}

/**
 * Deactivate a user account and revoke all their sessions.
 * Safeguard: admin cannot deactivate themselves.
 */
async function deactivateUser(id, adminUser) {
  if (id === adminUser.id) {
    throw createError('You cannot deactivate your own account', 403);
  }

  const target = await UserModel.findById(id);
  if (!target) throw createError('User not found', 404);
  if (!target.is_active) throw createError('User is already deactivated', 400);

  await UserModel.deactivate(id);
  const revokedSessions = await SessionModel.revokeAllByUserId(id, 'admin_revoked');

  return { revokedSessions: revokedSessions.length };
}

async function reactivateUser(id) {
  const target = await UserModel.findById(id);
  if (!target) throw createError('User not found', 404);
  if (target.is_active) throw createError('User is already active', 400);

  await UserModel.activate(id);
  return UserModel.findById(id);
}

// ── Session Management ────────────────────────────────────────────────────────

async function getUserActiveSessions(userId) {
  const user = await UserModel.findById(userId);
  if (!user) throw createError('User not found', 404);

  const { rows } = await query(
    `SELECT id, device_info, ip_address, created_at, expires_at, revoked_at
     FROM sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function forceLogoutUser(userId) {
  const user = await UserModel.findById(userId);
  if (!user) throw createError('User not found', 404);

  const revoked = await SessionModel.revokeAllByUserId(userId, 'admin_revoked');
  return { revokedCount: revoked.length };
}

async function listAllActiveSessions({ page = 1, limit = 20, search = '' } = {}) {
  const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;

  const searchCondition = search ? `AND (u.email ILIKE $3 OR u.name ILIKE $3)` : '';
  const params = search
    ? [safeLimit, offset, `%${search}%`]
    : [safeLimit, offset];

  const { rows } = await query(
    `SELECT s.id, s.user_id, u.name AS user_name, u.email AS user_email,
            s.device_info, s.ip_address, s.created_at, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
     ${searchCondition}
     ORDER BY s.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const countParams = search ? [`%${search}%`] : [];
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
     ${search ? 'AND (u.email ILIKE $1 OR u.name ILIKE $1)' : ''}`,
    countParams
  );

  return {
    sessions: rows,
    pagination: {
      total: countRows[0].total,
      page: parseInt(page, 10) || 1,
      limit: safeLimit,
      totalPages: Math.ceil(countRows[0].total / safeLimit),
    },
  };
}

async function revokeSession(sessionId) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw createError('Session not found', 404);
  if (session.revoked_at !== null) throw createError('Session already revoked', 400);

  await SessionModel.revokeOne(sessionId, 'admin_revoked');
  return { revoked: true };
}

// ── Quiz Analytics ────────────────────────────────────────────────────────────

async function getPlatformQuizStats() {
  const [stats, leaderboard] = await Promise.all([
    QuizModel.getPlatformStats(),
    QuizModel.getLeaderboard(1, 10),
  ]);
  return { ...stats, leaderboard };
}

async function getRecentQuizzes({ limit = 50, offset = 0 } = {}) {
  return QuizModel.getRecentQuizzes(limit, offset);
}

module.exports = {
  getPlatformOverview,
  listUsers,
  getUserDetail,
  updateUser,
  deactivateUser,
  reactivateUser,
  getUserActiveSessions,
  forceLogoutUser,
  listAllActiveSessions,
  revokeSession,
  getPlatformQuizStats,
  getRecentQuizzes,
};
