import React from 'react';

export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
}) => {
  const baseStyle =
    'px-4 py-2.5 rounded-btn font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2';

  const variants = {
    primary:
      'bg-primary hover:bg-primary-hover text-white shadow-soft focus:ring-olive-deep',
    secondary:
      'bg-btn-secondary hover:bg-sage-light text-olive-deep border border-beige focus:ring-olive-deep',
    danger:
      'bg-olive-deep hover:bg-primary text-surface shadow-soft focus:ring-olive-deep',
    outline:
      'bg-transparent hover:bg-sage-light text-olive-deep border border-beige hover:border-primary focus:ring-olive-deep',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
};
