import React from 'react';

/**
 * Industrial Button Component
 * Follows "Modern Industrialism" principles: Rectangular, 4px radius, no gradients.
 */
const Button = ({ 
  children, 
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  icon: Icon,
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-label-caps tracking-widest transition-all active:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary text-on-primary hover:opacity-90',
    secondary: 'bg-secondary text-on-secondary hover:opacity-90',
    outline: 'bg-surface-container-lowest border border-outline-variant text-primary hover:bg-surface-container-low',
    ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-primary',
  };

  const sizes = {
    sm: 'px-sm py-xs text-[10px]',
    md: 'px-md py-sm text-[11px]',
    lg: 'px-lg py-md text-[12px]',
  };

  const radius = 'rounded-default'; // 4px

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${radius} ${className}`}
      {...props}
    >
      {Icon && <span className="material-symbols-outlined mr-xs text-[1.2em]">{Icon}</span>}
      {children}
    </button>
  );
};

export default Button;
