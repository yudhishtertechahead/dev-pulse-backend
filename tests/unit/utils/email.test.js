/**
 * Unit tests for src/utils/email.js
 *
 * Strategy: mock nodemailer entirely at the module level so no SMTP
 * connections are attempted. We isolate the module between tests using
 * jest.isolateModules() so the module-level `transporter` variable is
 * always null when each test begins.
 */

const nodemailer = require('nodemailer');

// Mock the nodemailer module — Jest replaces it before any require() in the
// module under test, so no real connections ever happen.
jest.mock('nodemailer');

describe('email utility', () => {
  let sendMail;
  let verify;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();

    sendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
    verify = jest.fn().mockResolvedValue(true);
    mockTransporter = { sendMail, verify };

    nodemailer.createTransport.mockReturnValue(mockTransporter);
    nodemailer.createTestAccount.mockResolvedValue({
      user: 'ethereal@example.com',
      pass: 'ethereal_pass',
    });
    nodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/message/123');
  });

  // ── initTransporter ──────────────────────────────────────────────────────

  describe('initTransporter()', () => {
    it('should create a real transporter when SMTP env vars are set', async () => {
      let initTransporter;
      // Use isolateModules so the module-level `transporter` starts as null
      jest.isolateModules(() => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_USER = 'user@example.com';
        process.env.SMTP_PASS = 'secret';
        process.env.SMTP_PORT = '587';
        ({ initTransporter } = require('../../../src/utils/email'));
      });

      await initTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com', port: 587 })
      );
      expect(verify).toHaveBeenCalledTimes(1);
    });

    it('should fall back to Ethereal when SMTP env vars are missing', async () => {
      let initTransporter;
      jest.isolateModules(() => {
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        ({ initTransporter } = require('../../../src/utils/email'));
      });

      await initTransporter();

      expect(nodemailer.createTestAccount).toHaveBeenCalledTimes(1);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.ethereal.email' })
      );
    });

    it('should fall back to Ethereal when SMTP verification fails', async () => {
      verify.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      let initTransporter;
      jest.isolateModules(() => {
        process.env.SMTP_HOST = 'smtp.bad-host.com';
        process.env.SMTP_USER = 'user@example.com';
        process.env.SMTP_PASS = 'bad_pass';
        ({ initTransporter } = require('../../../src/utils/email'));
      });

      await initTransporter();

      // Should have tried real SMTP first, then fallen back to Ethereal
      expect(nodemailer.createTestAccount).toHaveBeenCalledTimes(1);
    });

    it('should strip spaces from SMTP_PASS (handles Gmail app passwords)', async () => {
      let initTransporter;
      jest.isolateModules(() => {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'user@gmail.com';
        process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
        process.env.SMTP_PORT = '465';
        ({ initTransporter } = require('../../../src/utils/email'));
      });

      await initTransporter();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'user@gmail.com', pass: 'abcdefghijklmnop' },
        })
      );
    });
  });

  // ── sendEmail ────────────────────────────────────────────────────────────

  describe('sendEmail()', () => {
    let initTransporter;
    let sendEmail;

    beforeEach(async () => {
      // Give every sendEmail test a fresh, ready transporter
      jest.isolateModules(() => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_USER = 'user@example.com';
        process.env.SMTP_PASS = 'secret';
        process.env.SMTP_PORT = '587';
        ({ initTransporter, sendEmail } = require('../../../src/utils/email'));
      });
      await initTransporter();
    });

    it('should call transporter.sendMail with the correct fields', async () => {
      const info = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Hello',
        html: '<p>World</p>',
      });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Hello',
          html: '<p>World</p>',
        })
      );
      expect(info.messageId).toBe('test-msg-id');
    });

    it('should use SMTP_FROM env var as the from address when set', async () => {
      process.env.SMTP_FROM = '"My App" <app@myapp.com>';

      await sendEmail({ to: 'a@b.com', subject: 'S', html: 'H' });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: '"My App" <app@myapp.com>' })
      );
    });

    it('should propagate SMTP errors thrown by sendMail', async () => {
      sendMail.mockRejectedValueOnce(new Error('SMTP connection reset'));

      await expect(
        sendEmail({ to: 'a@b.com', subject: 'S', html: 'H' })
      ).rejects.toThrow('SMTP connection reset');
    });
  });

  describe('sendEmail() — transporter not initialised', () => {
    it('should throw if sendEmail() is called without initTransporter()', async () => {
      let sendEmail;
      jest.isolateModules(() => {
        ({ sendEmail } = require('../../../src/utils/email'));
      });

      await expect(
        sendEmail({ to: 'a@b.com', subject: 'S', html: 'H' })
      ).rejects.toThrow('Email transporter is not initialised');
    });
  });
});
