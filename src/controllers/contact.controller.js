const { sendEmail } = require('../utils/email');

const submitContact = async (req, res, next) => {
  try {
    const { name, email, message } = req.body;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <div style="background: #f4f6f8; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; margin: 0;">${message}</p>
        </div>
      </div>
    `;

    // Send to a default support email or an environment variable
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@devpulse.com';
    
    await sendEmail({
      to: supportEmail,
      subject: `Contact Support: from ${name}`,
      html
    });

    res.status(200).json({
      success: true,
      message: 'Your message has been received. We will be in touch soon.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitContact };
