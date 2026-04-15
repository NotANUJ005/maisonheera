import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const toneConfig = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  error: {
    icon: AlertCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-900',
  },
  info: {
    icon: Info,
    className: 'border-stone-200 bg-white text-stone-900',
  },
};

export const ToastRegion = ({ toasts, onDismiss }) => (
  <div className="fixed top-24 right-4 z-[120] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
    <AnimatePresence>
      {toasts.map((toast) => {
        const tone = toneConfig[toast.tone] || toneConfig.info;
        const Icon = tone.icon;

        return (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className={`rounded-2xl border px-4 py-4 shadow-lg backdrop-blur-sm ${tone.className}`}
          >
            <div className="flex items-start gap-3">
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && <p className="mt-1 text-sm opacity-80">{toast.message}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => onDismiss(toast.id)}
                className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);
