import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false,
  ...props
}) => {
  const baseStyle =
    'relative overflow-hidden rounded-full border px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition-all duration-300 ease-in-out';
  const variants = {
    primary: 'border-stone-900 bg-stone-900 text-stone-50 disabled:border-stone-300 disabled:bg-stone-300',
    secondary: 'border-stone-900 bg-transparent text-stone-900 hover:text-stone-50 disabled:border-stone-300 disabled:text-stone-300',
    outline: 'border-stone-50 bg-transparent text-stone-50 hover:text-stone-900 disabled:border-white/30 disabled:text-white/40',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant] ?? variants.primary} ${className} ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {!disabled && (
        <motion.div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-0 ${
            variant === 'outline' ? 'bg-stone-50' : 'bg-stone-800'
          }`}
          initial={{ y: '100%' }}
          whileHover={{ y: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      )}
    </button>
  );
};
