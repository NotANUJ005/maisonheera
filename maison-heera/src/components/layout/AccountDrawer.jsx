import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X, Eye, EyeOff, Shield, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  requestAuthOtp,
  verifyAuthOtp,
  googleLoginApi,
} from '../../utils/api';
import { GoogleLogin } from '@react-oauth/google';

const initialFormData = {
  name: '',
  email: '',
  mobileNumber: '',
  password: '',
  otp: '',
  otpEmail: '',
  otpSms: '',
  newPassword: '',
  confirmPassword: '',
};

export const AccountDrawer = ({
  isOpen,
  onClose,
  userInfo,
  setUserInfo,
  onNavigate,
  setActiveAccountTab,
  notify,
}) => {
  const [authView, setAuthView] = useState('login');
  const [formData, setFormData] = useState(initialFormData);
  const [otpContext, setOtpContext] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const resetMessages = () => {
    setError('');
    setInfoMessage('');
  };

  const resetAll = () => {
    setFormData(initialFormData);
    setOtpContext(null);
    resetMessages();
    setAuthView('login');
    setShowPassword(false);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleSuccessfulAuth = (user) => {
    setUserInfo(user);
    setFormData(initialFormData);
    setOtpContext(null);
    resetMessages();
    setAuthView('login');
    notify({
      title: `Welcome, ${user.name}`,
      message: user.isAdmin ? 'Admin tools are now available.' : 'Your account is ready to shop.',
      tone: 'success',
    });
    onClose();
  };

  const switchAuthView = (nextView) => {
    setAuthView(nextView);
    setOtpContext(null);
    setFormData(initialFormData);
    resetMessages();
  };

  const requestOtp = async (customOtpMethod) => {
    const purpose = authView;
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (purpose === 'register') {
      if (!formData.name.trim() || !formData.password || !formData.mobileNumber.trim()) {
        throw new Error('Enter your name, mobile number, and a password.');
      }
      if (!passwordRegex.test(formData.password)) {
        throw new Error('Password must be at least 8 chars with uppercase, lowercase, number, and special char.');
      }
    }

    if (purpose === 'login' && !formData.password) {
      throw new Error('Password is required.');
    }

    const otpMethodToUse = customOtpMethod && typeof customOtpMethod === 'string' ? customOtpMethod : 'email';
    const result = await requestAuthOtp({
      purpose,
      name: formData.name.trim(),
      email: normalizedEmail,
      mobileNumber: formData.mobileNumber.trim(),
      password: formData.password,
      otpMethod: otpMethodToUse,
    });

    setOtpContext({
      purpose,
      email: result.actualEmail || normalizedEmail,
      mobileNumber: formData.mobileNumber.trim(),
      message: result.message,
      developmentOtp: result.developmentOtp || '',
    });
    setInfoMessage(result.message || 'OTP sent successfully.');
    setFormData((prev) => ({
      ...prev,
      otp: '',
      otpEmail: '',
      otpSms: '',
      newPassword: '',
      confirmPassword: '',
    }));
  };

  const verifyOtp = async () => {
    if (!otpContext) {
      throw new Error('OTP flow is not active.');
    }

    if (!formData.otp.trim()) {
      throw new Error('Enter the OTP sent to your email.');
    }

    if (otpContext.purpose === 'forgot-password') {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(formData.newPassword)) {
        throw new Error('Password must be at least 8 chars with uppercase, lowercase, number, and special char.');
      }

      if (formData.newPassword !== formData.confirmPassword) {
        throw new Error('New password and confirmation do not match.');
      }
    }

      if (otpContext.purpose === 'login') {
        const user = await verifyAuthOtp({
          purpose: 'login',
          email: otpContext.email,
          otp: formData.otp.trim(),
        });

        handleSuccessfulAuth(user);
        return;
      }

      if (otpContext.purpose === 'register') {
        if (!formData.otpEmail.trim() || !formData.otpSms.trim()) {
           throw new Error('Please enter both the Email and Mobile SMS OTPs.');
        }

        const fetchResult = await fetch('/api/users/register/verify-otp', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             email: otpContext.email,
             mobileNumber: otpContext.mobileNumber,
             otpEmail: formData.otpEmail.trim(),
             otpSms: formData.otpSms.trim()
           })
        });

        const userData = await fetchResult.json();
        if (!fetchResult.ok) {
           throw new Error(userData?.message || 'Verification failed');
        }

        handleSuccessfulAuth(userData);
        return;
      }

      await verifyAuthOtp({
        purpose: 'forgot-password',
        email: otpContext.email,
        otp: formData.otp.trim(),
        password: formData.newPassword,
      });

      notify({
        title: 'Password updated',
        message: 'Your password has been reset. You can sign in now.',
        tone: 'success',
      });
      setFormData({
        ...initialFormData,
        email: otpContext.email,
      });
      setOtpContext(null);
      setAuthView('login');
      setShowPassword(false);
      setInfoMessage('Password updated successfully. Sign in with your new password.');
  };

  const handlePrimarySubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    resetMessages();

    try {
      if (otpContext) {
        await verifyOtp();
      } else {
        await requestOtp();
      }
    } catch (submissionError) {
      setError(submissionError.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    resetMessages();
    try {
      const user = await googleLoginApi({ credential: credentialResponse.credential });
      handleSuccessfulAuth(user);
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async (customMethod) => {
    setIsLoading(true);
    resetMessages();

    try {
      await requestOtp(customMethod);
    } catch (resendError) {
      setError(resendError.message || 'Could not resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUserInfo(null);
    resetAll();
    notify({
      title: 'Signed out',
      message: 'Your session has been closed securely.',
      tone: 'info',
    });
  };

  const authTitle =
    authView === 'login'
      ? 'Sign In'
      : authView === 'register'
        ? 'Create Account'
        : 'Forgot Password';

  const authCopy =
    authView === 'login'
      ? 'Sign in with your password first. We then send a one-time OTP to complete the login securely.'
      : authView === 'register'
        ? 'Create your account, then verify your email with a one-time OTP before the account is activated.'
        : 'Enter your email to receive a one-time OTP for resetting your password.';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[101] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.4 }}
            className="fixed right-0 top-0 h-full w-full md:w-[460px] bg-[#FAF9F6] z-[102] shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Account Menu"
          >
            <div className="p-6 border-b border-stone-200 flex justify-between items-center">
              <h3 className="font-serif text-2xl">Account</h3>
              <button
                type="button"
                aria-label="Close Account Menu"
                onClick={onClose}
                className="p-2 hover:bg-stone-200 rounded-none transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12 pb-16 md:pb-20 [mask-image:linear-gradient(to_bottom,white_85%,transparent_100%)]">
              {userInfo ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
                  <div className="flex-1">
                    <div className="w-20 h-20 bg-stone-200 rounded-full flex items-center justify-center mb-6">
                      <User size={32} className="text-stone-500" />
                    </div>
                    <h2 className="text-3xl font-serif text-stone-900 mb-2">{userInfo.name}</h2>
                    <p className="text-stone-500 text-sm mb-2">{userInfo.email}</p>
                    <p className="text-stone-500 text-sm mb-12">
                      View your orders, manage saved pieces, and access concierge support.
                    </p>

                    <ul className="space-y-6 text-sm tracking-widest uppercase font-semibold text-stone-900">
                      {[
                        { id: 'orders', label: 'Order History' },
                        { id: 'wishlist', label: 'Wishlist' },
                        { id: 'addresses', label: 'Addresses' },
                        { id: 'details', label: 'Account Details' },
                      ].map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAccountTab(item.id);
                              onNavigate({ view: 'account' });
                              window.localStorage.setItem('maison-heera.account-tab', item.id);
                              onClose();
                            }}
                            className="hover:text-stone-500 transition-colors text-left w-full"
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {userInfo.isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate({ view: 'admin' });
                        onClose();
                      }}
                      className="group flex w-full items-center justify-between border border-stone-900 bg-stone-900 px-6 py-4 mt-8 text-[10px] uppercase tracking-[0.2em] text-white transition-all duration-500 hover:bg-transparent hover:text-stone-900"
                    >
                      <span>Admin Dashboard</span>
                      <Shield size={14} className="transition-transform duration-500 group-hover:scale-110" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="group flex w-full items-center justify-between border border-stone-300 bg-white px-6 py-4 mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-900 transition-all duration-500 hover:border-stone-900 hover:bg-stone-50"
                  >
                    <span>Sign Out</span>
                    <LogOut size={14} className="opacity-60 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-100" />
                  </button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={`${authView}-${otpContext?.purpose || 'form'}`}>
                  <h2 className="text-3xl font-serif text-stone-900 mb-2">
                    {otpContext ? 'Enter OTP' : authTitle}
                  </h2>
                  <p className="text-stone-500 text-sm mb-10">
                    {otpContext
                      ? `We sent a one-time password to ${otpContext.email}. Enter it below to continue.`
                      : authCopy}
                  </p>

                  <form onSubmit={handlePrimarySubmit} className="flex flex-col gap-8">
                    {error && (
                      <div className="text-rose-600 bg-rose-50 p-3 text-xs tracking-wider uppercase text-center border border-rose-100">
                        {error}
                      </div>
                    )}

                    {infoMessage && (
                      <div className="rounded-[1.5rem] bg-stone-100 px-4 py-4 text-sm text-stone-600">
                        {infoMessage}
                      </div>
                    )}

                    {otpContext?.developmentOtp && (
                      <div className="rounded-[1.5rem] bg-amber-50 px-4 py-4 text-sm text-amber-800 border border-amber-100">
                        Dev OTP: <span className="font-semibold tracking-[0.3em]">{otpContext.developmentOtp}</span>
                      </div>
                    )}

                    {!otpContext && authView === 'register' && (
                      <div className="relative">
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          placeholder=" "
                          className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none"
                        />
                        <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                          Full Name
                        </label>
                      </div>
                    )}

                    {!otpContext && (
                      <div className="relative">
                        <input
                          type={authView === 'login' ? 'text' : 'email'}
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          placeholder=" "
                          className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none"
                        />
                        <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                          {authView === 'login' ? 'Email or Mobile Number' : 'Email Address'}
                        </label>
                      </div>
                    )}
                    
                    {!otpContext && authView === 'register' && (
                      <div className="relative">
                        <input
                          type="text"
                          name="mobileNumber"
                          value={formData.mobileNumber}
                          onChange={handleInputChange}
                          required
                          placeholder=" "
                          className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none"
                        />
                        <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                          Mobile Number
                        </label>
                      </div>
                    )}

                    {!otpContext && (authView === 'login' || authView === 'register') && (
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          autoComplete="current-password"
                          placeholder=" "
                          className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none pr-8"
                        />
                        <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 top-2 text-stone-400 hover:text-stone-600 transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    )}

                    {otpContext && otpContext.purpose !== 'register' && (
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            name="otp"
                            value={formData.otp}
                            onChange={handleInputChange}
                            required
                            inputMode="numeric"
                            maxLength={6}
                            placeholder=" "
                            className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none tracking-[0.35em]"
                          />
                          <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                            OTP Code
                          </label>
                        </div>

                        {otpContext.purpose === 'forgot-password' && (
                          <>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                required
                                placeholder=" "
                                className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none pr-8"
                              />
                              <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                                New Password
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-2 text-stone-400 hover:text-stone-600 transition-colors"
                              >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>

                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                required
                                placeholder=" "
                                className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none pr-8"
                              />
                              <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                                Confirm Password
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-2 text-stone-400 hover:text-stone-600 transition-colors"
                              >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {otpContext && otpContext.purpose === 'register' && (
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            name="otpEmail"
                            value={formData.otpEmail}
                            onChange={handleInputChange}
                            required
                            inputMode="numeric"
                            maxLength={6}
                            placeholder=" "
                            className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none tracking-[0.35em]"
                          />
                          <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                            Email OTP Code
                          </label>
                        </div>
                        <div className="relative mt-2">
                          <input
                            type="text"
                            name="otpSms"
                            value={formData.otpSms}
                            onChange={handleInputChange}
                            required
                            inputMode="numeric"
                            maxLength={6}
                            placeholder=" "
                            className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none tracking-[0.35em]"
                          />
                          <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                            Mobile SMS OTP Code
                          </label>
                        </div>
                      </>
                    )}

                    {!otpContext && authView === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchAuthView('forgot-password')}
                        className="text-left text-xs uppercase tracking-widest font-semibold text-stone-900 hover:text-stone-500 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}

                    <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                      {isLoading
                        ? 'Please Wait...'
                        : otpContext
                          ? otpContext.purpose === 'forgot-password'
                            ? 'Verify OTP and Reset Password'
                            : 'Verify OTP'
                          : 'Send OTP'}
                    </Button>

                    {!otpContext && (authView === 'login' || authView === 'register') && (
                      <div className="flex flex-col gap-4 mt-2">
                        <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-stone-300"></div>
                          <span className="flex-shrink-0 mx-4 text-stone-400 text-xs uppercase tracking-widest">Or</span>
                          <div className="flex-grow border-t border-stone-300"></div>
                        </div>
                        <div className="flex justify-center">
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => {
                              setError('Google Login failed.');
                            }}
                            useOneTap
                            theme="outline"
                            shape="pill"
                            text={authView === 'login' ? 'signin_with' : 'signup_with'}
                          />
                        </div>
                      </div>
                    )}

                    {otpContext && (
                      <div className="flex flex-col gap-3">
                        <Button type="button" variant="secondary" onClick={() => handleResendOtp()} disabled={isLoading}>
                          Resend Verification Codes
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpContext(null);
                            resetMessages();
                            setFormData((prev) => ({
                              ...prev,
                              otp: '',
                              otpEmail: '',
                              otpSms: '',
                              newPassword: '',
                              confirmPassword: '',
                            }));
                          }}
                          className="uppercase tracking-widest text-xs font-semibold text-stone-900 hover:text-stone-500 transition-colors"
                        >
                          Back
                        </button>
                      </div>
                    )}
                  </form>

                  {!otpContext && (
                    <div className="mt-12 pt-8 border-t border-stone-200 text-center">
                      <p className="text-stone-500 text-sm mb-4">
                        {authView === 'login'
                          ? "Don't have an account?"
                          : authView === 'register'
                            ? 'Already have an account?'
                            : 'Want to return to sign in?'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (authView === 'login') {
                            switchAuthView('register');
                          } else {
                            switchAuthView('login');
                          }
                        }}
                        className="uppercase tracking-widest text-xs font-semibold text-stone-900 hover:text-stone-500 transition-colors"
                      >
                        {authView === 'login' ? 'Create an Account' : 'Sign In'}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
