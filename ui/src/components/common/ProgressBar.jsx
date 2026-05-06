import React from 'react';

/**
 * Industrial Progress Bar Component
 * Principles: Thin, high-contrast, no glow.
 */
const ProgressBar = ({ 
  progress = 0, // 0 to 100
  label, 
  value, 
  className = '', 
  height = 'h-1' 
}) => {
  return (
    <div className={`flex flex-col gap-sm ${className}`}>
      {(label || value) && (
        <div className="flex justify-between items-center">
          {label && <span className="font-label-caps text-primary uppercase">{label}</span>}
          {value && <span className="font-code text-primary text-body-sm">{value}</span>}
        </div>
      )}
      <div className={`w-full bg-surface-container-high ${height} overflow-hidden rounded-full`}>
        <div 
          className="bg-primary h-full transition-all duration-300 ease-out" 
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
