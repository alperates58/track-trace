import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export interface TTAlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  icon?: boolean;
}

export const TTAlert: React.FC<TTAlertProps> = ({
  variant = 'info',
  title,
  children,
  icon = true
}) => {
  const getIcon = () => {
    if (!icon) return null;
    switch (variant) {
      case 'success': return <CheckCircle size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      case 'error': return <AlertCircle size={20} />;
      default: return <Info size={20} />;
    }
  };

  return (
    <div className={`tt-alert tt-alert-${variant}`}>
      {icon && <div className="tt-alert-icon">{getIcon()}</div>}
      <div className="tt-alert-content">
        {title && <h5 className="tt-alert-title">{title}</h5>}
        <div className="tt-alert-body">{children}</div>
      </div>
    </div>
  );
};
