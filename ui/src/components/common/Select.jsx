import React from 'react';

/**
 * Industrial Select Component
 */
const Select = ({ 
  label, 
  options = [], 
  className = '', 
  containerClassName = '',
  ...props 
}) => {
  return (
    <div className={`flex flex-col gap-xs ${containerClassName}`}>
      {label && <label className="font-label-caps text-on-surface-variant">{label}</label>}
      <select 
        className={`bg-surface-container-low border border-outline-variant px-sm py-xs font-body-base text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
