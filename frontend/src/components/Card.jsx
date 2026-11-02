import React from 'react';

export const Card = ({ children, title, className = '', headerAction }) => {
  return (
    <div className={`rounded-2xl p-6 shadow-soft border border-beige bg-cream transition-colors duration-300 ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-beige">
          {title && <h3 className="text-lg font-heading font-semibold text-olive-deep">{title}</h3>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
