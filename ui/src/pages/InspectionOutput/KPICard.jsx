import React from 'react';

const KPICard = ({ label, value, subValue, subLabel, variant = 'default' }) => {
  const isError = variant === 'error';
  
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant p-panel-padding shadow-sm ${isError ? 'border-b-4 border-b-error' : ''}`}>
      <p className="font-label-caps text-[10px] text-on-surface-variant mb-base">{label}</p>
      <div className="flex items-end justify-between">
        <span className={`font-display text-display ${isError ? 'text-error' : 'text-primary'}`}>{value}</span>
        {subValue && (
          <div className="flex flex-col items-end">
             {subLabel && <span className={`font-label-caps text-[9px] px-1 ${isError ? 'bg-error-container text-error' : 'text-on-surface-variant'}`}>{subLabel}</span>}
             <span className="text-on-surface-variant font-body-sm text-[11px] mb-base">{subValue}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
