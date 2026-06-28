// utils/mailer.js — Sends emails via Gmail SMTP using Nodemailer
//
// Setup required in backend/.env:
//   GMAIL_USER=youraddress@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (a 16-char Gmail "App Password", NOT your normal password)
//
// How to get a Gmail App Password:
//   1. Turn on 2-Step Verification on the Gmail account: https://myaccount.google.com/security
//   2. Go to https://myaccount.google.com/apppasswords
//   3. Create an app password for "Mail" and paste it into GMAIL_APP_PASSWORD above.

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will not be sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

// ── Send the newsletter welcome email ──────────────────────────
async function sendWelcomeEmail(toEmail) {
  const t = getTransporter();
  if (!t) return; // silently skip if email isn't configured — subscriber is still saved to DB

  await t.sendMail({
    from: `"AMAN MEDICAL" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Welcome to AMAN MEDICAL — you\'re subscribed! 💊',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#16316F;">You're on the list! 🎉</h2>
        <p>Thanks for subscribing to AMAN MEDICAL. You'll now get refill reminders and restock alerts straight to your inbox.</p>
        <p style="color:#888; font-size:13px;">If you didn't sign up for this, you can ignore this email — you won't receive anything further unless you subscribe again.</p>
      </div>
    `,
  });
}

module.exports = { sendWelcomeEmail };
