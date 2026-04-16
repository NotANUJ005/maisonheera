import crypto from 'crypto';
import nodemailer from 'nodemailer';

const OTP_LENGTH = 6;

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

const getPurposeCopy = (purpose) => {
  switch (purpose) {
    case 'register':
      return {
        subject: 'Verify your Maison Heera registration',
        heading: 'Complete your registration',
      };
    case 'login':
      return {
        subject: 'Your Maison Heera login OTP',
        heading: 'Confirm your sign in',
      };
    case 'password_reset':
      return {
        subject: 'Your Maison Heera password reset OTP',
        heading: 'Reset your password',
      };
    default:
      return {
        subject: 'Your Maison Heera OTP',
        heading: 'Complete your verification',
      };
  }
};

export const generateOtpCode = () =>
  crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH).toString();

export const hashOtpCode = (code) =>
  crypto.createHash('sha256').update(String(code)).digest('hex');

export const isOtpDevelopmentMode = () => process.env.OTP_DEBUG_MODE === 'true';

export const sendOtpEmail = async ({ email, name, purpose, code }) => {
  const transporter = getTransporter();

  if (!transporter) {
    return { delivered: false };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const copy = getPurposeCopy(purpose);

  await transporter.sendMail({
    from,
    to: email,
    subject: copy.subject,
    text: `Hello ${name || 'there'},\n\n${copy.heading} with this one-time password: ${code}\n\nThis OTP expires in 10 minutes.\n`,
    html: `
      <p>Hello ${name || 'there'},</p>
      <p>${copy.heading} with this one-time password:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:0.3em;">${code}</p>
      <p>This OTP expires in 10 minutes.</p>
    `,
  });

  return { delivered: true };
};

export const sendOtpSms = async ({ mobileNumber, name, purpose, code }) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_MESSAGING_SERVICE_SID } = process.env;

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_PHONE_NUMBER || TWILIO_MESSAGING_SERVICE_SID)) {
     const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
     const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
     const params = new URLSearchParams();
     params.append('To', mobileNumber);
     
     if (TWILIO_MESSAGING_SERVICE_SID) {
       params.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
     } else {
       params.append('From', TWILIO_PHONE_NUMBER);
     }
     
     params.append('Body', `[Maison Heera] Your OTP for ${purpose === 'register_sms' ? 'registration' : 'verification'} is: ${code}`);

     try {
       const res = await fetch(url, {
         method: 'POST',
         headers: {
           'Authorization': `Basic ${auth}`,
           'Content-Type': 'application/x-www-form-urlencoded'
         },
         body: params.toString()
       });
       
       if (!res.ok) {
         console.error(`Twilio SMS Failed: ${await res.text()}`);
       }
       return { delivered: res.ok };
     } catch (err) {
       console.error(`Twilio SMS Request Failed: ${err.message}`);
       return { delivered: false };
     }
  }

  // Fallback if no Twilio details
  console.log(`[SMS MOCK] Sending OTP ${code} for ${purpose} to ${mobileNumber}`);
  return { delivered: true }; // we just mock delivery
};
