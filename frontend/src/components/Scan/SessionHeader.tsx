import React from 'react';

interface SessionHeaderProps {
  isOnline: boolean;
  operatorName?: string;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({ isOnline, operatorName }) => {
  return (
    <header className="scan-session-header h-13 flex items-center justify-between px-4 md:px-6 shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="scan-session-title flex items-center gap-3">
        <h1 className="text-base md:text-lg font-bold m-0" style={{ color: 'var(--text-main)' }}>Ürün Okutma Terminali</h1>
        <span className="tt-badge tt-badge-neutral text-xs font-medium">Otomatik Koli</span>
      </div>
      <div className="scan-session-meta flex items-center gap-3">
        <div className="scan-session-status flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ backgroundColor: isOnline ? 'var(--success-bg)' : 'var(--danger-bg)', borderColor: isOnline ? 'var(--success-border)' : 'var(--danger-border)' }}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-semibold" style={{ color: isOnline ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </span>
        </div>
        {operatorName && (
          <div className="scan-session-operator flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Operatör:</span>
            <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>{operatorName}</span>
          </div>
        )}
      </div>
    </header>
  );
};
