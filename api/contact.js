import nodemailer from 'nodemailer';

const RECIPIENTS = ['contact@roamerz.io', 'polskoydm@gmail.com'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body || {};

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Missing name, email, or message' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      error: 'Server email not configured',
      detail: {
        host: SMTP_HOST ? 'set' : 'MISSING',
        user: SMTP_USER ? 'set' : 'MISSING',
        pass: SMTP_PASS ? 'set' : 'MISSING',
        port: SMTP_PORT || '(default 587)',
      },
    });
  }

  const port = Number(SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: RECIPIENTS.join(','),
      replyTo: email.trim(),
      subject: `Contact from ${name.trim()}`,
      text: `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`,
    });
    console.log('Email sent:', info.messageId);
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error('sendMail failed', err);
    return res.status(500).json({
      error: 'Send failed',
      detail: {
        code: err.code || null,
        command: err.command || null,
        responseCode: err.responseCode || null,
        response: err.response || null,
        message: err.message || String(err),
        host: SMTP_HOST,
        port,
        secure: port === 465,
        user: SMTP_USER,
      },
    });
  }
}
