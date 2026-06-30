import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface TTDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export const TTDrawer: React.FC<TTDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = '400px'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="tt-drawer-backdrop" onClick={onClose} />
      <div className="tt-drawer" style={{ width }}>
        <div className="tt-drawer-header">
          <h3 className="tt-drawer-title">{title}</h3>
          <button className="tt-drawer-close" onClick={onClose} aria-label="Kapat">
            <X size={20} />
          </button>
        </div>
        <div className="tt-drawer-content">
          {children}
        </div>
        {footer && <div className="tt-drawer-footer">{footer}</div>}
      </div>
    </>
  );
};
