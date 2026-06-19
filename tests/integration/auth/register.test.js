/**
 * tests/integration/auth/register.test.js
 *
 * POST /api/v1/auth/register
 *
 * Covers:
 *  - Happy path: user created, persisted to DB, password not leaked
 *  - Duplicate email → 409
 *  - Invalid email format → 400
 *  - Mismatched passwords → 400
 *  - Weak password → 400
 *  - Missing required fields → 400
 */

const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/db');
const { truncateTables } = require('../../helpers/db.helper');
const { REGISTER_PAYLOAD } = require('../../helpers/auth.helper');

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('should register a new user and persist them to the DB', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(REGISTER_PAYLOAD);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('test@example.com');
    // Password must NOT be leaked in the response
    expect(response.body.data.password).toBeUndefined();

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['test@example.com']
    );
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Test User');
  });

  it('should return 409 if the email is already registered', async () => {
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER_PAYLOAD, name: 'Another User' });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Email already in use');
  });

  it('should return 400 for an invalid email format', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER_PAYLOAD, email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 if passwords do not match', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER_PAYLOAD, confirmPassword: 'DifferentPass@1' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 if the password is too weak (no special chars)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER_PAYLOAD, password: 'weakpass', confirmPassword: 'weakpass' });

    expect(response.status).toBe(400);
  });

  it('should return 400 when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com' }); // missing name, password, confirmPassword

    expect(response.status).toBe(400);
  });
});
