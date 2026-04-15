import crypto from 'crypto';
import nodemailer from 'nodemailer';

const getBaseUrl = (requestOrigin) =>
  (process.env.FRONTEND_URL || requestOrigin || 'http://localhost:5173').replace(/\/$/, '');

export const createPasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  return {
    token,
    hashedToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30),
  };
};

export const hashPasswordResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const buildPasswordResetUrl = ({ requestOrigin, token }) =>
  `${getBaseUrl(requestOrigin)}/#/reset-password?token=${encodeURIComponent(token)}`;

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const transporter = getTransporter();

  if (!transporter) {
    return { delivered: false };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Reset your Maison Heera password',
    text: `Hello ${name || 'there'},\n\nUse the link below to reset your password:\n${resetUrl}\n\nThis link expires in 30 minutes.\n`,
    html: `
      <p>Hello ${name || 'there'},</p>
      <p>Use the link below to reset your Maison Heera password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 30 minutes.</p>
    `,
  });

  return { delivered: true };
};
