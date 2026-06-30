import React from 'react';

export interface TTCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  noShadow?: boolean;
}

export const TTCard: React.FC<TTCardProps> = ({
  children,
  className = '',
  padding = 'md',
  noShadow = false
}) => {
  const baseClasses = 'tt-card';
  const paddingClasses = `tt-card-padding-${padding}`;
  const shadowClasses = noShadow ? 'tt-card-no-shadow' : '';

  return (
    <div className={`${baseClasses} ${paddingClasses} ${shadowClasses} ${className}`}>
      {children}
    </div>
  );
};
