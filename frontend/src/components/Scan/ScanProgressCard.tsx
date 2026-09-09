import React from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface ScanProgressCardProps {
  productName: string | null;
  stockCode: string | null;
  gtin: string | null;
  currentQty: number;
  targetQty: number;
  isInputFocused: boolean;
  onFocusRequest: () => void;
}

export const ScanProgressCard: React.FC<ScanProgressCardProps> = ({
  productName,
  stockCode,
  gtin,
  currentQty,
  targetQty,
  isInputFocused,
  onFocusRequest
}) => {
  const progressPercent = targetQty > 0 ? Math.min(100, (currentQty / targetQty) * 100) : 0;
  const remainingQty = Math.max(0, targetQty - currentQty);
  
  const isTargetReached = currentQty > 0 && currentQty >= targetQty;

  if (!productName) {
    return (
      <div 
        className="scan-progress-card flex-1 p-6 xl:p-10 flex flex-col justify-center items-center relative overflow-hidden transition-colors shadow-xs"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: !isInputFocused ? '2px solid var(--warning)' : '1px solid var(--border-subtle)'
        }}
        onClick={onFocusRequest}
      >
        {!isInputFocused && (
          <div className="scan-focus-warning absolute top-0 left-0 w-full py-2 flex items-center justify-center gap-2 text-xs font-bold z-20" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', borderBottom: '1px solid var(--warning-border)' }}>
            <AlertTriangle className="w-4 h-4" />
            <span>OKUTMA ODAĞI KAYBOLDU — Tıklayın veya F8'e basın</span>
          </div>
        )}
        <div className="font-medium text-base flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <TrendingUp className="w-12 h-12 opacity-40" />
          Okutmaya başlamak için istasyon, sipariş ve ürün seçin
        </div>
      </div>
    );
  }

  return (
    <div 
      className="scan-progress-card flex-1 transition-all duration-200 p-6 xl:p-8 flex flex-col relative overflow-hidden cursor-default shadow-xs"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: !isInputFocused 
          ? '2px solid var(--warning)' 
          : isTargetReached 
            ? '1px solid var(--success-border)' 
            : '1px solid var(--border-subtle)'
      }}
      onClick={onFocusRequest}
    >
      {/* Odak Kaybı Uyarı Bandı */}
      {!isInputFocused && (
        <div className="scan-focus-warning absolute top-0 left-0 w-full py-1.5 flex items-center justify-center gap-2 text-xs font-bold z-20 shadow-xs" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)', borderBottom: '1px solid var(--warning-border)' }}>
          <AlertTriangle className="w-4 h-4" />
          <span className="tracking-wide">OKUTMA ODAĞI KAYBOLDU — Tıklayın veya F8'e basın</span>
        </div>
      )}

      {/* Product Info */}
      <div className={`flex flex-col gap-2 z-10 ${!isInputFocused ? 'mt-6' : ''}`}>
        <span className={`tt-badge self-start text-[11px] font-bold tracking-wider uppercase ${isTargetReached ? 'tt-badge-success' : 'tt-badge-primary'}`}>
          {isTargetReached ? 'HEDEF TAMAMLANDI' : 'Aktif Ürün'}
        </span>
        <h2 
          className="text-xl md:text-2xl lg:text-3xl font-extrabold leading-snug line-clamp-2 break-words" 
          style={{ color: 'var(--text-main)', letterSpacing: '-0.02em' }}
          title={productName}
        >
          {productName}
        </h2>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="px-2.5 py-0.5 font-mono font-bold rounded text-xs md:text-sm border" style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-main)' }}>
            {stockCode}
          </span>
          <span className="px-2 py-0.5 font-mono font-medium rounded text-xs border" style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            GTIN: {gtin}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[16px] md:min-h-[32px]"></div>

      {/* Stats Grid */}
      <div className="scan-stats-grid grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8 z-10">
        
        <div className="flex flex-col gap-0.5 p-3 md:p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border-subtle)' }}>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Beklenen</span>
          <span className="text-xl md:text-3xl font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>{targetQty.toLocaleString()}</span>
        </div>

        <div 
          className="flex flex-col gap-0.5 p-3 md:p-4 rounded-lg border transition-colors" 
          style={{ 
            backgroundColor: isTargetReached ? 'var(--success-bg)' : 'var(--primary-light)', 
            borderColor: isTargetReached ? 'var(--success-border)' : 'var(--border-subtle)' 
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isTargetReached ? 'var(--success-text)' : 'var(--primary)' }}>
            Okutulan
          </span>
          <span className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tight tabular-nums" style={{ color: isTargetReached ? 'var(--success-text)' : 'var(--primary)' }}>
            {currentQty.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-3 md:p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border-subtle)' }}>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Kalan</span>
          <span className="text-xl md:text-3xl font-bold tabular-nums" style={{ color: 'var(--text-main)' }}>{remainingQty.toLocaleString()}</span>
        </div>

      </div>

      {/* Progress Bar */}
      <div className="w-full flex flex-col gap-2 z-10 shrink-0">
        <div className="flex justify-between items-end">
          <span className="font-semibold text-xs md:text-sm flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <TrendingUp className="w-3.5 h-3.5" />
            İlerleme Oranı
          </span>
          <span className="text-lg md:text-xl font-black tabular-nums" style={{ color: isTargetReached ? 'var(--success-text)' : 'var(--primary)' }}>
            %{Math.round(progressPercent)}
          </span>
        </div>
        <div className="h-3 w-full rounded-full overflow-hidden border" style={{ backgroundColor: 'var(--bg-surface-subtle)', borderColor: 'var(--border-subtle)' }}>
          <div 
            className="h-full rounded-full transition-all duration-300" 
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: isTargetReached ? 'var(--success)' : 'var(--primary)'
            }}
          />
        </div>
      </div>

    </div>
  );
};
