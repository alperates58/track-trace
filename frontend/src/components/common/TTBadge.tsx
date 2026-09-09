import React from 'react';

export interface TTBadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'active';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const TTBadge: React.FC<TTBadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
  style
}) => {
  const baseClasses = 'tt-badge';
  const resolvedVariant = variant === 'active' ? 'primary' : variant;
  const variantClasses = `tt-badge-${resolvedVariant}`;
  const sizeClasses = `tt-badge-${size}`;

  return (
    <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`} style={style}>
      {icon && <span className="tt-badge-icon">{icon}</span>}
      {children}
    </span>
  );
};
