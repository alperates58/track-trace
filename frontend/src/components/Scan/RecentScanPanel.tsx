import React from 'react';
import { Check, X, History, RotateCcw } from 'lucide-react';

export interface ScanHistoryItem {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string; // 'Başarılı' | 'Hata' | 'Geri Alındı' vb.
  timestamp: string;
  cartonNo: string;
}

interface RecentScanPanelProps {
  history: ScanHistoryItem[];
  errorMsg?: string;
  onRemoveItem?: (rawCode: string) => void;
  activeCartonNo?: string | null;
}

export const RecentScanPanel: React.FC<RecentScanPanelProps> = ({ 
  history, 
  errorMsg,
  onRemoveItem,
  activeCartonNo
}) => {
  return (
    <div 
      className="scan-history-panel w-full lg:w-[350px] 2xl:w-[420px] flex flex-col overflow-hidden shrink-0 h-full shadow-xs"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div className="p-3 md:p-3.5 border-b flex justify-between items-center shrink-0" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)' }}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-bold text-sm md:text-base m-0" style={{ color: 'var(--text-main)' }}>Okutma Geçmişi</h3>
        </div>
        <span className="tt-badge tt-badge-neutral text-[11px] font-semibold">
          Son 10 Okuma
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 md:p-2.5 flex flex-col gap-1.5 no-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5 py-8" style={{ color: 'var(--text-muted)' }}>
            <History className="w-10 h-10 opacity-30" />
            <span className="text-xs font-medium">Bu oturumda okuma yapılmadı</span>
          </div>
        ) : (
          history.map((item, idx) => {
            const isSuccess = item.status === 'Başarılı';
            const isRemoved = item.status === 'Geri Alındı';
            const isLatestError = !isSuccess && !isRemoved && idx === 0;
            const canRemove = isSuccess && onRemoveItem && (!activeCartonNo || item.cartonNo === activeCartonNo);
            
            const opacityClass = idx === 0 ? 'opacity-100' : idx < 3 ? 'opacity-90' : idx < 6 ? 'opacity-75' : 'opacity-60';
            
            const displayMsg = isRemoved
              ? 'Koliden Çıkarıldı'
              : !isSuccess 
                ? (isLatestError && errorMsg ? errorMsg : item.status) 
                : 'Başarılı Okuma';

            return (
              <div 
                key={`${item.rawCode}-${item.timestamp}-${idx}`} 
                className={`flex items-center gap-2.5 p-2 md:p-2.5 border transition-all ${opacityClass}`}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isRemoved 
                    ? 'var(--warning-bg)' 
                    : isSuccess 
                      ? (idx === 0 ? 'var(--success-bg)' : 'var(--bg-surface-subtle)') 
                      : 'var(--danger-bg)',
                  borderColor: isRemoved 
                    ? 'var(--warning-border)' 
                    : isSuccess 
                      ? (idx === 0 ? 'var(--success-border)' : 'var(--border-subtle)') 
                      : 'var(--danger-border)'
                }}
              >
                <div 
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isRemoved 
                      ? 'var(--warning-bg)' 
                      : isSuccess 
                        ? 'var(--success)' 
                        : 'var(--danger)',
                    color: '#fff'
                  }}
                >
                  {isRemoved ? (
                    <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                  ) : isSuccess ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <X className="w-4 h-4 stroke-[2.5]" />
                  )}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <span 
                    className={`font-mono font-bold text-xs md:text-sm truncate tabular-nums ${
                      isRemoved ? 'line-through text-muted' : isSuccess ? 'text-main' : 'line-through text-danger'
                    }`}
                    title={item.rawCode}
                  >
                    {item.rawCode}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span 
                      className="text-[10px] md:text-[11px] font-semibold truncate"
                      style={{
                        color: isRemoved ? 'var(--warning-text)' : isSuccess ? 'var(--success-text)' : 'var(--danger-text)'
                      }}
                      title={displayMsg}
                    >
                      {displayMsg}
                    </span>
                    {item.cartonNo && item.cartonNo !== '-' && (
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        · {item.cartonNo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canRemove && (
                    <button
                      onClick={() => onRemoveItem(item.rawCode)}
                      className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Bu barkodu koliden çıkar (Geri Al)"
                      aria-label="Koliden çıkar"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span 
                    className="text-[10px] md:text-[11px] font-semibold px-1.5 py-0.5 rounded border tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {item.timestamp}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
