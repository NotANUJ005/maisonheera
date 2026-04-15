import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import AuthOtp from '../models/AuthOtp.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  sendPasswordResetEmail,
} from '../utils/passwordReset.js';
import {
  generateOtpCode,
  hashOtpCode,
  isOtpDevelopmentMode,
  sendOtpEmail,
} from '../utils/authOtp.js';

const OTP_EXPIRY_MS = 1000 * 60 * 10;
const OTP_MAX_ATTEMPTS = 5;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const router = express.Router();

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

const formatUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  mobileNumber: user.mobileNumber || '',
  isAdmin: user.isAdmin,
  addresses: user.addresses || [],
  cart: user.cart || [],
  wishlist: user.wishlist || [],
  token: generateToken(user._id),
});

const ensureDefaultAddress = (user) => {
  if (!user.addresses.length) return;

  const hasDefault = user.addresses.some((address) => address.isDefault);
  if (!hasDefault) {
    user.addresses[0].isDefault = true;
  }
};

const clearOtpPurpose = async (email, purpose) => {
  await AuthOtp.deleteMany({
    email,
    purpose,
  });
};

const createOtpChallenge = async ({ email, purpose, payload = {}, recipientName }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await clearOtpPurpose(normalizedEmail, purpose);

  await AuthOtp.create({
    email: normalizedEmail,
    purpose,
    codeHash,
    payload,
    expiresAt,
  });

  let mailResult = { delivered: false };
  try {
    mailResult = await sendOtpEmail({
      email: normalizedEmail,
      name: recipientName,
      purpose,
      code,
    });
  } catch (error) {
    console.error(`OTP delivery failed for ${purpose}:`, error.message);
  }

  return {
    message: 'OTP sent successfully.',
    ...(isOtpDevelopmentMode() ? { developmentOtp: code } : {}),
  };
};

const isStrongPassword = (password) => STRONG_PASSWORD_REGEX.test(String(password || ''));

const consumeOtpChallenge = async ({ email, purpose, code }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const otpEntry = await AuthOtp.findOne({
    email: normalizedEmail,
    purpose,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpEntry) {
    throw new Error('OTP is invalid or has expired.');
  }

  const submittedHash = hashOtpCode(code);
  if (otpEntry.codeHash !== submittedHash) {
    otpEntry.attempts += 1;

    if (otpEntry.attempts >= OTP_MAX_ATTEMPTS) {
      await otpEntry.deleteOne();
      throw new Error('Too many invalid OTP attempts. Request a new code.');
    }

    await otpEntry.save();
    throw new Error('Incorrect OTP. Please try again.');
  }

  const payload = otpEntry.payload || {};
  await otpEntry.deleteOne();
  return payload;
};

router.post('/login/request-otp', async (req, res) => {
  const { email, password } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const otpResponse = await createOtpChallenge({
      email: normalizedEmail,
      purpose: 'login',
      payload: { userId: String(user._id) },
      recipientName: user.name,
    });

    return res.json({
      message: 'We have sent a login OTP to your email address.',
      ...otpResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/login/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email?.trim() || !otp?.trim()) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const payload = await consumeOtpChallenge({
      email,
      purpose: 'login',
      code: otp.trim(),
    });

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    ensureDefaultAddress(user);
    return res.json(formatUserResponse(user));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/register/request-otp', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!name?.trim() || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otpResponse = await createOtpChallenge({
      email: normalizedEmail,
      purpose: 'register',
      payload: {
        name: name.trim(),
        password,
      },
      recipientName: name.trim(),
    });

    return res.json({
      message: 'We have sent a verification OTP to your email address.',
      ...otpResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/register/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !otp?.trim()) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const payload = await consumeOtpChallenge({
      email: normalizedEmail,
      purpose: 'register',
      code: otp.trim(),
    });

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name: payload.name,
      email: normalizedEmail,
      password: payload.password,
      addresses: [],
    });

    return res.status(201).json(formatUserResponse(user));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/forgot-password/request-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({
        message: 'If an account exists for that email, a password reset OTP has been sent.',
      });
    }

    const otpResponse = await createOtpChallenge({
      email: normalizedEmail,
      purpose: 'password_reset',
      payload: { userId: String(user._id) },
      recipientName: user.name,
    });

    return res.json({
      message: 'We have sent a password reset OTP to your email address.',
      ...otpResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/forgot-password/verify-otp', async (req, res) => {
  const { email, otp, password } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !otp?.trim() || !password) {
      return res.status(400).json({ message: 'Email, OTP, and password are required.' });
    }
    
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
    }

    const payload = await consumeOtpChallenge({
      email: normalizedEmail,
      purpose: 'password_reset',
      code: otp.trim(),
    });

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user && (await user.matchPassword(password))) {
      ensureDefaultAddress(user);
      return res.json(formatUserResponse(user));
    }

    return res.status(401).json({ message: 'Invalid email or password' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/google-login', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Google credential missing' });
  }

  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid google token payload' });
    }

    const { email, name, sub } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // User doesn't exist, create one
      user = await User.create({
        name,
        email: normalizedEmail,
        googleId: sub,
        authProvider: 'google',
        addresses: [],
      });
    } else {
      // User exists, but might not have googleId linked
      if (!user.googleId) {
        user.googleId = sub;
        // Do not change local authProvider to google if they originally signed up via email
        // Or you can if you prefer. Given the schema, authProvider could be google.
      }
      await user.save();
    }

    ensureDefaultAddress(user);
    return res.json(formatUserResponse(user));
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ message: 'Authentication failed. Please try again later.' });
  }
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      addresses: [],
    });

    if (user) {
      return res.status(201).json(formatUserResponse(user));
    }

    return res.status(400).json({ message: 'Invalid user data' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  const genericResponse = {
    message: 'If an account exists for that email, password reset instructions have been sent.',
  };

  try {
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json(genericResponse);
    }

    const { token, hashedToken, expiresAt } = createPasswordResetToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    const resetUrl = buildPasswordResetUrl({
      requestOrigin: req.headers.origin,
      token,
    });

    let mailResult = { delivered: false };
    try {
      mailResult = await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (mailError) {
      console.error('Password reset email delivery failed:', mailError.message);
    }

    return res.json({
      ...genericResponse,
      ...(mailResult.delivered || process.env.NODE_ENV === 'production'
        ? {}
        : { developmentResetUrl: resetUrl, developmentResetToken: token }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    return res.json({ message: 'Reset link is valid.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || !isStrongPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
    }

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    ensureDefaultAddress(user);
    return res.json(formatUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, password, currentPassword, cart, wishlist, mobileNumber } = req.body;

    if (cart) user.cart = cart;
    if (wishlist) user.wishlist = wishlist;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && String(existingUser._id) !== String(user._id)) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }

    user.name = name?.trim() || user.name;
    user.email = email?.trim().toLowerCase() || user.email;

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change your password.' });
      }
      
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect.' });
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
      }

      user.password = password;
    }

    ensureDefaultAddress(user);
    await user.save();
    return res.json(formatUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      label,
      fullName,
      email,
      phone,
      address,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    if (!fullName || !email || !phone || !address || !city || !state || !postalCode || !country) {
      return res.status(400).json({ message: 'Address details are incomplete' });
    }

    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach((item) => {
        item.isDefault = false;
      });
    }

    user.addresses.push({
      label: label || `Address ${user.addresses.length + 1}`,
      fullName,
      email,
      phone,
      address,
      city,
      state,
      postalCode,
      country,
      isDefault: Boolean(isDefault) || user.addresses.length === 0,
    });

    ensureDefaultAddress(user);
    await user.save();
    return res.status(201).json(formatUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/addresses/:addressId/default', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const selectedAddress = user.addresses.id(req.params.addressId);
    if (!selectedAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    user.addresses.forEach((address) => {
      address.isDefault = String(address._id) === req.params.addressId;
    });

    await user.save();
    return res.json(formatUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const selectedAddress = user.addresses.id(req.params.addressId);
    if (!selectedAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const {
      label,
      fullName,
      email,
      phone,
      address,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    selectedAddress.label = label || selectedAddress.label;
    selectedAddress.fullName = fullName || selectedAddress.fullName;
    selectedAddress.email = email || selectedAddress.email;
    selectedAddress.phone = phone || selectedAddress.phone;
    selectedAddress.address = address || selectedAddress.address;
    selectedAddress.city = city || selectedAddress.city;
    selectedAddress.state = state || selectedAddress.state;
    selectedAddress.postalCode = postalCode || selectedAddress.postalCode;
    selectedAddress.country = country || selectedAddress.country;

    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      selectedAddress.isDefault = true;
    } else {
      selectedAddress.isDefault = false;
    }

    ensureDefaultAddress(user);
    await user.save();
    return res.json(formatUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const selectedAddress = user.addresses.id(req.params.addressId);
    if (!selectedAddress) {
      return res.status(404).json({ message: 'Address not found' });
    }

    selectedAddress.deleteOne();
    ensureDefaultAddress(user);
    await user.save();
    return res.json(formatUserResponse(user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
