import React, { ButtonHTMLAttributes } from 'react';

export interface TTButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const TTButton: React.FC<TTButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'tt-btn';
  const variantClasses = `tt-btn-${variant}`;
  const sizeClasses = `tt-btn-${size}`;
  const loadingClasses = loading ? 'tt-btn-loading' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${loadingClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="tt-spinner" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="tt-btn-icon-left">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="tt-btn-icon-right">{icon}</span>}
        </>
      )}
    </button>
  );
};
