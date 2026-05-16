import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useToastStore from '../../store/useToastStore';

const iconMap = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
};

const colorMap = {
  info: 'text-[#2563EB] bg-[#2563EB08] border-[#2563EB30]',
  success: 'text-[#22C55E] bg-[#22C55E08] border-[#22C55E30]',
  warning: 'text-[#F59E0B] bg-[#F59E0B08] border-[#F59E0B30]',
  error: 'text-[#EF4444] bg-[#EF444408] border-[#EF444430]',
};

const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed top-20 right-lg z-[100] flex flex-col gap-sm max-w-[400px]">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`
              flex items-start gap-sm px-md py-sm rounded-lg border shadow-lg backdrop-blur-md
              bg-surface-container-lowest/95
              ${colorMap[toast.type] || colorMap.info}
            `}
          >
            <span
              className="material-symbols-outlined text-[18px] mt-[1px] flex-shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {iconMap[toast.type] || 'info'}
            </span>
            <p className="font-body-sm text-on-surface flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-on-surface flex-shrink-0 cursor-pointer"
            >
              close
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
