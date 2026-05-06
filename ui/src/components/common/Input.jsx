import React from 'react';

/**
 * Industrial Input Component
 * Principles: #F1F5F9 background, focus transitions.
 */
const Input = ({ 
  label, 
  error, 
  className = '', 
  containerClassName = '',
  ...props 
}) => {
  return (
    <div className={`flex flex-col gap-xs ${containerClassName}`}>
      {label && <label className="font-label-caps text-on-surface-variant">{label}</label>}
      <input 
        className={`bg-surface-container-low border border-outline-variant px-sm py-xs font-code text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline ${error ? 'border-error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-[10px] text-error font-medium">{error}</span>}
    </div>
  );
};

export default Input;
