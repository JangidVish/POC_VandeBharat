import React from 'react';

/**
 * GlassCard — Premium card component with subtle glassmorphism.
 * Per DESIGN.md: white bg, 1px border, 8px radius for large containers.
 * Glass effect is subtle — NOT full transparency.
 */
const GlassCard = ({
  children,
  className = '',
  title,
  icon,
  action,
  padding = true,
  glass = false,
  ...props
}) => {
  return (
    <div
      className={`
        rounded-lg border border-outline-variant overflow-hidden
        ${glass
          ? 'bg-surface-container-lowest/92 backdrop-blur-xl'
          : 'bg-surface-container-lowest'
        }
        ${className}
      `}
      {...props}
    >
      {(title || icon || action) && (
        <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
          <div className="flex items-center gap-sm">
            {icon && (
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{icon}</span>
            )}
            {title && (
              <span className="font-label-caps text-[11px] text-on-surface-variant tracking-wider">{title}</span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {padding ? (
        <div className="p-md">{children}</div>
      ) : (
        children
      )}
    </div>
  );
};

export default GlassCard;
