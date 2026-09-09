import React from 'react';

export interface TTCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  noShadow?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const TTCard: React.FC<TTCardProps> = ({
  children,
  className = '',
  padding = 'md',
  noShadow = false,
  style,
  onClick
}) => {
  const baseClasses = 'tt-card';
  const paddingClasses = `tt-card-padding-${padding}`;
  const shadowClasses = noShadow ? 'tt-card-no-shadow' : '';

  return (
    <div 
      className={`${baseClasses} ${paddingClasses} ${shadowClasses} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
