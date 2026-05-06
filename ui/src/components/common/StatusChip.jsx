import React from 'react';

/**
 * Status Chip Component
 * Principles: Rectangular, 2px radius, muted backgrounds, high-contrast text.
 */
const StatusChip = ({ 
  label, 
  variant = 'neutral', // 'neutral' | 'success' | 'warning' | 'error' | 'info'
  icon: Icon,
  className = '' 
}) => {
  const variants = {
    neutral: 'bg-surface-container text-on-surface-variant border-outline-variant',
    success: 'bg-secondary-container text-on-secondary-container border-secondary/20',
    warning: 'bg-tertiary-container text-on-tertiary-container border-tertiary/20',
    error: 'bg-error-container text-on-error-container border-error/20',
    info: 'bg-primary-fixed text-on-primary-fixed border-primary/10',
  };

  return (
    <div className={`inline-flex items-center gap-xs px-sm py-[2px] rounded-sm border font-label-caps text-[10px] ${variants[variant]} ${className}`}>
      {Icon && <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{Icon}</span>}
      {label}
    </div>
  );
};

export default StatusChip;
