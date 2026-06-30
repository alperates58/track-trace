import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface TTModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const TTModal: React.FC<TTModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '500px'
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
    <div className="tt-modal-overlay" onClick={onClose}>
      <div className="tt-modal" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        <div className="tt-modal-header">
          <h3 className="tt-modal-title">{title}</h3>
          <button className="tt-modal-close" onClick={onClose} aria-label="Kapat">
            <X size={20} />
          </button>
        </div>
        <div className="tt-modal-content">
          {children}
        </div>
        {footer && <div className="tt-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
