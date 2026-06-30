import React from 'react';

export interface TTEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const TTEmptyState: React.FC<TTEmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="tt-empty-state">
      <div className="tt-empty-state-icon">{icon}</div>
      <h3 className="tt-empty-state-title">{title}</h3>
      {description && <p className="tt-empty-state-desc">{description}</p>}
      {action && <div className="tt-empty-state-action">{action}</div>}
    </div>
  );
};
