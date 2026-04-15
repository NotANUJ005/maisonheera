import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import {
  jsonRequest,
  resetLocalPassword,
  shouldUseLocalFallback,
  validateLocalPasswordReset,
} from '../utils/api';

export const ResetPassword = ({ token, onNavigate, notify }) => {
  const [status, setStatus] = useState('checking');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }

      try {
        const response = await jsonRequest(`/api/users/reset-password/${encodeURIComponent(token)}`, {
          includeAuth: false,
        });

        if (!response.ok) {
          if (!shouldUseLocalFallback(response.status)) {
            throw new Error(response.data?.message || 'Reset link is invalid');
          }

          throw new Error('Temporary server issue');
        }

        setStatus('ready');
      } catch {
        setStatus(validateLocalPasswordReset(token) ? 'ready' : 'invalid');
      }
    };

    validateToken();
  }, [token]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formData.password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await jsonRequest(`/api/users/reset-password/${encodeURIComponent(token)}`, {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify({
          password: formData.password,
        }),
      });

      if (!response.ok) {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Could not reset password');
        }

        throw new Error('Temporary server issue');
      }

      notify({
        title: 'Password updated',
        message: 'You can now sign in with your new password.',
        tone: 'success',
      });
      onNavigate({ view: 'home' });
    } catch (apiError) {
      try {
        resetLocalPassword(token, formData.password);
        notify({
          title: 'Password updated',
          message: 'Your local account password has been reset successfully.',
          tone: 'success',
        });
        onNavigate({ view: 'home' });
      } catch (localError) {
        setError(localError.message || apiError.message);
        setStatus('invalid');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="pt-32 pb-24 px-6 md:px-12 max-w-3xl mx-auto min-h-screen"
    >
      <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm md:p-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone-400">Password Recovery</p>
        <h1 className="mt-3 text-4xl font-serif text-stone-900">Reset your password</h1>

        {status === 'checking' && (
          <p className="mt-8 text-stone-500">Validating your reset link...</p>
        )}

        {status === 'invalid' && (
          <div className="mt-8 space-y-5">
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error || 'This password reset link is invalid or has expired.'}
            </p>
            <Button variant="secondary" onClick={() => onNavigate({ view: 'home' })}>
              Back to Home
            </Button>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <p className="text-sm text-stone-500">
              Choose a new password for your Maison Heera account.
            </p>

            {error && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            <label className="block text-sm text-stone-600">
              <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                New Password
              </span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                required
              />
            </label>

            <label className="block text-sm text-stone-600">
              <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                Confirm Password
              </span>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                required
              />
            </label>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>
    </motion.div>
  );
};
