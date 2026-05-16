import React from 'react';

const Spinner = ({ size = 24, color = 'currentColor', className = '' }) => {
  return (
    <div
      className={`animate-spin flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        border: `3px solid ${color}33`,
        borderTopColor: color,
        borderRadius: '50%',
      }}
    />
  );
};

export default Spinner;
