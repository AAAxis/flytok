// Local SMTP test — isolates SMTP credentials from Vercel.
// Usage:
//   1. Copy .env.example to .env and fill in SMTP_PASS
//   2. node --env-file=.env test-email.js
//
// If this works locally, the same creds will work on Vercel.
// If this fails, the error here tells us exactly why.

import nodemailer from 'nodemailer';

const {
  SMTP_HOST = 'mail.privateemail.com',
  SMTP_PORT = '587',
  SMTP_USER = 'dima@holylabs.net',
  SMTP_PASS,
  SMTP_FROM,
  TEST_TO = 'polskoydm@gmail.com',
} = process.env;

if (!SMTP_PASS) {
  console.error('❌ SMTP_PASS missing. Put it in .env file.');
  console.error('   Example:  echo "SMTP_PASS=your-password-here" > .env');
  process.exit(1);
}

const port = Number(SMTP_PORT);
const secure = port === 465;

console.log('▶ SMTP config:');
console.log('  host:', SMTP_HOST);
console.log('  port:', port, secure ? '(SSL)' : '(STARTTLS)');
console.log('  user:', SMTP_USER);
console.log('  to:  ', TEST_TO);
console.log('');

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  logger: true,
  debug: true,
});

try {
  console.log('▶ Verifying connection…');
  await transporter.verify();
  console.log('✓ Connection + auth OK');

  console.log('▶ Sending test email…');
  const info = await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: TEST_TO,
    subject: 'flytok SMTP test — ' + new Date().toISOString(),
    text: 'If you see this, SMTP works from flytok. Same creds will work on Vercel.',
  });
  console.log('✓ Sent. messageId:', info.messageId);
  console.log('  envelope:', info.envelope);
  console.log('  accepted:', info.accepted);
  console.log('  rejected:', info.rejected);
  console.log('  response:', info.response);
  console.log('');
  console.log('✅ Check', TEST_TO, 'inbox (and spam folder).');
} catch (err) {
  console.error('');
  console.error('❌ FAILED');
  console.error('  code:        ', err.code);
  console.error('  command:     ', err.command);
  console.error('  responseCode:', err.responseCode);
  console.error('  response:    ', err.response);
  console.error('  message:     ', err.message);
  process.exit(2);
}
