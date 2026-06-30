import React from 'react';

export interface TTSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const TTSection: React.FC<TTSectionProps> = ({ title, icon, children, action }) => {
  return (
    <div className="tt-section">
      <div className="tt-section-header">
        <h3 className="tt-section-title">
          {icon && <span className="tt-section-icon">{icon}</span>}
          {title}
        </h3>
        {action && <div className="tt-section-action">{action}</div>}
      </div>
      <div className="tt-section-content">
        {children}
      </div>
    </div>
  );
};
