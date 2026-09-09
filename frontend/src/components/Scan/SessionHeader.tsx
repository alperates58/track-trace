import React from 'react';

interface SessionHeaderProps {
  isOnline: boolean;
  operatorName?: string;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({ isOnline, operatorName }) => {
  return (
    <header className="scan-session-header h-14 flex items-center justify-between px-6 shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="scan-session-title flex items-center gap-4">
        <h1 className="text-xl font-bold m-0" style={{ color: 'var(--text-main)' }}>Ürün Okutma Terminali</h1>
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Otomatik Koli Modu</span>
      </div>
      <div className="scan-session-meta flex items-center gap-4">
        <div className={`scan-session-status flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`} style={{ backgroundColor: isOnline ? 'var(--success-bg)' : 'var(--danger-bg)', borderColor: isOnline ? 'var(--success-border)' : 'var(--danger-border)' }}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
          <span className="text-xs font-bold" style={{ color: isOnline ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </span>
        </div>
        {operatorName && (
          <div className="scan-session-operator flex items-center gap-3 px-3 py-1.5 rounded-full" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-subtle)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Operatör: {operatorName}</span>
          </div>
        )}
      </div>
    </header>
  );
};
