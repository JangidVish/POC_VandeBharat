import React from 'react';

/**
 * Modular Card Component
 * Principles: Flat white background, 1px border, header divider.
 */
const Card = ({ 
  children, 
  title, 
  icon: Icon, 
  extra, 
  className = '', 
  padding = true,
  noBorder = false
}) => {
  return (
    <div className={`bg-surface-container-lowest ${noBorder ? '' : 'border border-outline-variant'} rounded-default overflow-hidden ${className}`}>
      {(title || Icon || extra) && (
        <div className="px-panel-padding py-sm border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-sm">
            {Icon && <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{Icon}</span>}
            {title && <h3 className="font-h2 text-primary">{title}</h3>}
          </div>
          {extra && <div className="flex items-center">{extra}</div>}
        </div>
      )}
      <div className={`${padding ? 'p-panel-padding' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Card;
