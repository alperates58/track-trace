import React from 'react';

export interface TTPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: string;
}

export const TTPageHeader: React.FC<TTPageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumb
}) => {
  return (
    <div className="tt-page-header">
      <div className="tt-page-header-content">
        {breadcrumb && <span className="tt-page-header-breadcrumb">{breadcrumb}</span>}
        <h2 className="tt-page-header-title">{title}</h2>
        {description && <p className="tt-page-header-desc">{description}</p>}
      </div>
      {actions && <div className="tt-page-header-actions">{actions}</div>}
    </div>
  );
};
