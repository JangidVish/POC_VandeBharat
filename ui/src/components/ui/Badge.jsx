import React from 'react';

const variantStyles = {
  success: 'bg-[#22C55E18] text-[#22C55E] border-[#22C55E55]',
  warning: 'bg-[#F59E0B18] text-[#F59E0B] border-[#F59E0B55]',
  critical: 'bg-[#EF444418] text-[#EF4444] border-[#EF444455]',
  processing: 'bg-[#2563EB18] text-[#2563EB] border-[#2563EB55]',
  neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
};

const Badge = ({ children, variant = 'neutral', className = '' }) => {
  return (
    <span
      className={`
        inline-flex items-center px-[7px] py-[2px] rounded-sm
        text-[10px] font-bold leading-tight border
        ${variantStyles[variant] || variantStyles.neutral}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Badge;
