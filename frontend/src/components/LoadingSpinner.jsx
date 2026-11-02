import React from 'react';

export const LoadingSpinner = ({ size = 'md', label, message = 'Loading...' }) => {
  const displayLabel = label !== undefined ? label : message;
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-3">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-primary/20 border-t-primary rounded-full animate-spin`}
      />
      {displayLabel && <p className="text-xs font-medium text-ink-soft">{displayLabel}</p>}
    </div>
  );
};

export default LoadingSpinner;
