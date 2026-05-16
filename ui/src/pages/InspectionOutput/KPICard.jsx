import React from 'react';

const KPICard = ({ label, value, subValue, subLabel, variant = 'default' }) => {
  const isError = variant === 'error';
  
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant p-panel-padding lg:p-lg shadow-sm min-w-0 ${isError ? 'border-b-4 border-b-error' : ''}`}>
      <p className="font-label-caps text-[11px] lg:text-[12px] text-on-surface-variant mb-sm truncate">{label}</p>
      <div className="flex items-end justify-between gap-sm">
        <span className={`font-display text-[28px] lg:text-[32px] xl:text-[36px] truncate ${isError ? 'text-error' : 'text-primary'}`}>{value}</span>
        {subValue && (
          <div className="flex flex-col items-end min-w-0">
             {subLabel && <span className={`font-label-caps text-[10px] lg:text-[11px] px-1.5 truncate ${isError ? 'bg-error-container text-error' : 'text-on-surface-variant'}`}>{subLabel}</span>}
             <span className="text-on-surface-variant font-body-sm text-[12px] lg:text-[13px] mb-base truncate">{subValue}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
