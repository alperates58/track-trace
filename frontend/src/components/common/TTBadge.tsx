import React from 'react';

export interface TTBadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const TTBadge: React.FC<TTBadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = ''
}) => {
  const baseClasses = 'tt-badge';
  const variantClasses = `tt-badge-${variant}`;
  const sizeClasses = `tt-badge-${size}`;

  return (
    <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}>
      {icon && <span className="tt-badge-icon">{icon}</span>}
      {children}
    </span>
  );
};
