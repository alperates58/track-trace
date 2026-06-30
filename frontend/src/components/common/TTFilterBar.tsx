import React from 'react';

export interface TTFilterBarProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const TTFilterBar: React.FC<TTFilterBarProps> = ({ children, actions }) => {
  return (
    <div className="tt-filter-bar">
      <div className="tt-filter-bar-inputs">
        {children}
      </div>
      {actions && <div className="tt-filter-bar-actions">{actions}</div>}
    </div>
  );
};
