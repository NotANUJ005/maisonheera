import mongoose from 'mongoose';

const authOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ['login', 'register', 'password_reset'],
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  },
);

const AuthOtp = mongoose.model('AuthOtp', authOtpSchema);

export default AuthOtp;
