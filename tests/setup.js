require('dotenv').config({ path: '.env.test' });
const nodemailer = require('nodemailer');
const { pool } = require('../src/config/db');
const { initTransporter } = require('../src/utils/email');

// ── Global test bootstrapping ─────────────────────────────────────────────────

/**
 * Initialise the email transporter before any test suite runs.
 * In test mode we point at Ethereal (nodemailer's sandbox SMTP) so that
 * calling sendEmail() in integration tests doesn't throw
 * "transporter not initialised" and doesn't reach a real inbox.
 */
beforeAll(async () => {
  // Stub nodemailer so createTestAccount() returns instantly (no network call)
  // and sendMail() is a no-op — we just need the transporter to exist.
  const stubTransport = {
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  };
  jest.spyOn(nodemailer, 'createTransport').mockReturnValue(stubTransport);
  jest.spyOn(nodemailer, 'createTestAccount').mockResolvedValue({
    user: 'test@ethereal.email',
    pass: 'testpass',
  });
  jest.spyOn(nodemailer, 'getTestMessageUrl').mockReturnValue(null);

  // Clear SMTP env vars so initTransporter falls through to Ethereal stub
  const savedHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  await initTransporter();
  if (savedHost) process.env.SMTP_HOST = savedHost;
});

afterAll(async () => {
  // Close the DB pool so Jest doesn't hang waiting for open handles
  await pool.end();
});

