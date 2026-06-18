/**
 * tests/integration/auth/password.test.js
 *
 * Password reset flows:
 *   POST /api/v1/auth/forgot-password
 *   POST /api/v1/auth/reset-password
 *
 * Covers:
 *  Forgot Password:
 *    - Valid registered email → 200
 *    - Unknown email in dev/test mode → 404
 *    - Missing email field → 400
 *
 *  Reset Password (validation):
 *    - Invalid / non-existent token → 400
 *    - Weak new password → 400
 *    - Mismatched confirmPassword → 400
 *
 *  Full End-to-End Reset Flow [P1]:
 *    - forgot → insert known token → reset → login with new password ✅ → old password ❌
 *    - Expired token → 400 with "expired" message
 *    - Successful reset revokes all active sessions
 */

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/db');
const { truncateTables } = require('../../helpers/db.helper');
const { REGISTER_PAYLOAD, registerAndLogin } = require('../../helpers/auth.helper');

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Inserts a known plaintext token into password_resets for testing.
 * Returns the plaintext token so it can be sent to the API.
 */
async function insertKnownResetToken(userId, { plaintextToken, expiresFromNow = 3600 }) {
  const tokenHash = crypto.createHash('sha256').update(plaintextToken).digest('hex');
  const expiresAt = new Date(Date.now() + expiresFromNow * 1000);

  await pool.query(`DELETE FROM password_resets WHERE user_id = $1`, [userId]);
  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return plaintextToken;
}

// ── Forgot Password ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(async () => {
    await truncateTables();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
  });

  it('should accept a request for a registered email and return 200', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toMatch(/email/i);
  });

  it('should return 404 for an unregistered email (dev/test mode shows explicit error)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    expect(response.status).toBe(404);
  });

  it('should return 400 when the email field is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({});

    expect(response.status).toBe(400);
  });
});

// ── Reset Password — Validation ─────────────────────────────────────────────

describe('POST /api/v1/auth/reset-password — validation', () => {
  beforeEach(async () => {
    await truncateTables();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
  });

  it('should return 400 for a completely invalid / non-existent reset token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'test@example.com',
        token: 'completely-invalid-token',
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when the new password is too weak', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'test@example.com',
        token: 'some-token',
        newPassword: 'weakpass',
        confirmPassword: 'weakpass',
      });

    expect(response.status).toBe(400);
  });

  it('should return 400 when confirmPassword does not match newPassword', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'test@example.com',
        token: 'some-token',
        newPassword: 'NewPassword@123',
        confirmPassword: 'DifferentPass@1',
      });

    expect(response.status).toBe(400);
  });
});

// ── Full Password Reset — End to End [P1] ───────────────────────────────────

describe('Password Reset — Full End-to-End Flow', () => {
  beforeEach(async () => {
    await truncateTables();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
  });

  it('should complete the full flow: request → reset → new password works → old password fails', async () => {
    // Step 1: Trigger forgot-password (creates a DB record)
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'test@example.com' });
    expect(forgotRes.status).toBe(200);

    // Step 2: Inject a known token so we can call reset-password without reading emails
    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE email = $1`, ['test@example.com']
    );
    const knownToken = await insertKnownResetToken(users[0].id, {
      plaintextToken: 'e2e-reset-token-123456789012345678901234567890',
    });

    // Step 3: Reset the password using the known token
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'test@example.com',
        token: knownToken,
        newPassword: 'NewPassword@456',
        confirmPassword: 'NewPassword@456',
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Step 4: New password should now work
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'NewPassword@456' });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.accessToken).toBeDefined();

    // Step 5: Old password should be rejected
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password@123' });
    expect(oldLoginRes.status).toBe(401);
  });

  it('should return 400 when the reset token is expired', async () => {
    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE email = $1`, ['test@example.com']
    );
    // expiresFromNow is negative → token already expired 1 hour ago
    const expiredToken = await insertKnownResetToken(users[0].id, {
      plaintextToken: 'expired-token-12345678901234567890123456789012',
      expiresFromNow: -3600,
    });

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'test@example.com',
        token: expiredToken,
        newPassword: 'NewPassword@456',
        confirmPassword: 'NewPassword@456',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/expired/i);
  });

  it('should revoke all active sessions after a successful password reset', async () => {
    // Create a live session first
    const { refreshTokenCookie } = await registerAndLogin();

    // Inject a valid known token
    const { rows: users } = await pool.query(
      `SELECT id FROM users WHERE email = $1`, ['test@example.com']
    );
    const knownToken = await insertKnownResetToken(users[0].id, {
      plaintextToken: 'session-revoke-token-12345678901234567890123456789',
    });

    // Perform the reset
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'test@example.com',
        token: knownToken,
        newPassword: 'AnotherPass@789',
        confirmPassword: 'AnotherPass@789',
      });

    // The old refresh token must now be invalid
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(refreshRes.status).toBe(401);
  });
});
