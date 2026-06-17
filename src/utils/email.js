const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Build and verify the Nodemailer transporter.
 * Called once on app startup so errors surface immediately.
 */
const initTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  // Strip spaces from app passwords (Gmail shows them as groups of 4)
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    // Verify the connection immediately so any mis-config is caught on startup
    try {
      await transporter.verify();
      console.log(`✅ Email transporter ready — SMTP: ${user}@${host}:${port}`);
    } catch (err) {
      console.error('❌ Email transporter FAILED to connect:', err.message);
      console.error('   Check SMTP_HOST / SMTP_USER / SMTP_PASS in your .env');
      transporter = null; // will fall back to Ethereal below
    }
  }

  // Fall back to Ethereal if SMTP is not configured or failed to verify
  if (!transporter) {
    console.warn('⚠️  No valid SMTP config — using Ethereal test account.');
    console.warn('   Emails will NOT reach real inboxes. Set SMTP_* vars in .env to send real mail.');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`   Ethereal test account: ${testAccount.user}`);
  }
};

/**
 * Send an email.
 * @param {{ to: string, subject: string, html: string }} options
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    throw new Error('Email transporter is not initialised. Call initTransporter() on app startup.');
  }

  const from = process.env.SMTP_FROM || '"DevPulse" <noreply@devpulse.com>';

  const info = await transporter.sendMail({ from, to, subject, html });

  console.log(`📧 Email sent to ${to} — messageId: ${info.messageId}`);

  // Preview URL only works for Ethereal accounts
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('🔗 Ethereal preview URL (email not sent to real inbox):');
    console.log('  ', previewUrl);
  }

  return info;
};

module.exports = { initTransporter, sendEmail };
