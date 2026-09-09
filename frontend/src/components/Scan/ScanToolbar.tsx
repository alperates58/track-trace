import React, { useMemo } from 'react';
import { Camera, Printer, Volume2, VolumeX, Keyboard, MousePointerClick, ChevronDown, RotateCcw } from 'lucide-react';
import { ProductSelector, ProductOption } from './ProductSelector';

export interface Station {
  id: string;
  name: string;
}

export interface ActiveOrder extends ProductOption {
  orderNo: string;
  customerName: string;
  productPerCarton: number;
}

interface ScanToolbarProps {
  stations: Station[];
  selectedStationId: string;
  onStationChange: (id: string) => void;
  activeOrders: ActiveOrder[];
  selectedOrderNo: string;
  onOrderNoChange: (orderNo: string) => void;
  selectedProductId: string;
  onProductChange: (id: string) => void;
  isInputFocused: boolean;
  onFocusRequest: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenPrinterSettings: () => void;
  onOpenCamera: () => void;
  onCloseFocusRestoration?: () => void;
  onUndoLast?: () => void;
  canUndo?: boolean;
  isUndoing?: boolean;
}

export const ScanToolbar: React.FC<ScanToolbarProps> = ({
  stations,
  selectedStationId,
  onStationChange,
  activeOrders,
  selectedOrderNo,
  onOrderNoChange,
  selectedProductId,
  onProductChange,
  isInputFocused,
  onFocusRequest,
  soundEnabled,
  onToggleSound,
  onOpenPrinterSettings,
  onOpenCamera,
  onCloseFocusRestoration,
  onUndoLast,
  canUndo,
  isUndoing
}) => {
  // Unique order numbers
  const uniqueOrderNos = useMemo(() => {
    const nos = new Set<string>();
    const result: { orderNo: string; customerName: string }[] = [];
    activeOrders.forEach(o => {
      if (!nos.has(o.orderNo)) {
        nos.add(o.orderNo);
        result.push({ orderNo: o.orderNo, customerName: o.customerName });
      }
    });
    return result;
  }, [activeOrders]);

  // Products for the selected order
  const productsForOrder = useMemo(() => {
    if (!selectedOrderNo) return [];
    return activeOrders.filter(o => o.orderNo === selectedOrderNo);
  }, [activeOrders, selectedOrderNo]);


  return (
    <div className="scan-toolbar relative z-20 p-2.5 md:p-3 flex flex-wrap lg:flex-nowrap gap-3 shrink-0 items-end overflow-visible shadow-xs" style={{ position: 'relative', zIndex: 30000, overflow: 'visible', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
      {/* İstasyon */}
      <div className="scan-toolbar-field scan-toolbar-station flex flex-col gap-1 shrink-0 w-32 md:w-44 relative">
        <label className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: 'var(--text-muted)' }}>İstasyon</label>
        <div className="relative">
          <select 
            value={selectedStationId}
            onChange={(e) => {
              onStationChange(e.target.value);
              if (onCloseFocusRestoration) onCloseFocusRestoration();
            }}
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}
            className="w-full appearance-none border h-9 py-1.5 pl-3 pr-8 text-xs md:text-sm font-semibold cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- İstasyon Seç --</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Sipariş */}
      <div className="scan-toolbar-field scan-toolbar-order flex flex-col gap-1 shrink-0 w-44 md:w-60 relative">
        <label className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: 'var(--text-muted)' }}>İş Emri / Sipariş</label>
        <div className="relative">
          <select 
            value={selectedOrderNo}
            onChange={(e) => {
              onOrderNoChange(e.target.value);
              if (onCloseFocusRestoration) onCloseFocusRestoration();
            }}
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-subtle)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}
            className="w-full appearance-none border h-9 py-1.5 pl-3 pr-8 text-xs md:text-sm font-semibold cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
          >
            <option value="">-- Sipariş Seç --</option>
            {uniqueOrderNos.map(o => (
              <option key={o.orderNo} value={o.orderNo}>
                {o.orderNo} {o.customerName ? `- ${o.customerName}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Ürün Seçici (Virtualized) */}
      <ProductSelector 
        products={productsForOrder}
        selectedId={selectedProductId}
        onChange={onProductChange}
        disabled={!selectedOrderNo}
        onCloseFocusRestoration={onCloseFocusRestoration}
      />

      <div className="w-px h-8 mx-1 mb-1 hidden sm:block" style={{ backgroundColor: 'var(--border-subtle)' }}></div>

      {/* Odak Info */}
      <div 
        className="scan-focus-control group relative flex items-center justify-center mb-0.5 mr-1 cursor-pointer"
        onClick={onFocusRequest}
        title="Odağı geri almak için tıklayın veya F8'e basın"
      >
        <div 
          className="flex items-center justify-center w-9 h-9 transition-colors"
          style={{
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isInputFocused ? 'var(--primary-light)' : 'var(--warning-bg)',
            border: `1px solid ${isInputFocused ? 'var(--border-subtle)' : 'var(--warning-border)'}`,
            color: isInputFocused ? 'var(--primary)' : 'var(--warning-text)'
          }}
        >
          {isInputFocused ? <Keyboard className="w-4 h-4" /> : <MousePointerClick className="w-4 h-4" />}
        </div>
        <span className="scan-focus-label sr-only">
          {isInputFocused ? 'Okutma odağı aktif' : 'Okutma odağı kayıp — dokunarak geri al'}
        </span>
        <div className="absolute top-10 w-max bg-gray-900 text-white text-xs px-2.5 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
          {isInputFocused ? 'Odak Aktif (F8)' : 'Odak Kayboldu (Tıklayın / F8)'}
        </div>
      </div>

      {/* Actions */}
      <div className="scan-toolbar-actions flex items-center gap-1.5 shrink-0 mb-0.5">
        {onUndoLast && (
          <button 
            onClick={() => { onUndoLast(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
            disabled={!canUndo || isUndoing}
            className="btn btn-sm btn-secondary flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold shadow-xs"
            style={{
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--warning-border)',
              backgroundColor: canUndo ? 'var(--warning-bg)' : 'var(--bg-surface-subtle)',
              color: canUndo ? 'var(--warning-text)' : 'var(--text-muted)'
            }}
            title="Son Okutulan Ürünü Koliden Çıkar (Ctrl+Z)"
            aria-label="Son Okutulan Ürünü Koliden Çıkar"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Geri Al</span>
          </button>
        )}

        <button 
          onClick={() => { onOpenCamera(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
          className="btn btn-sm btn-secondary flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold"
          style={{ borderRadius: 'var(--radius-sm)' }}
          title="Kamera ile Okut"
          aria-label="Kamera ile Okut"
        >
          <Camera className="w-3.5 h-3.5" style={{ color: 'var(--warning-text)' }} />
          <span className="hidden xl:inline">Kamera</span>
        </button>
        <button 
          onClick={() => { onOpenPrinterSettings(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
          className="btn btn-sm btn-secondary flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold"
          style={{ borderRadius: 'var(--radius-sm)' }}
          title="Yazıcı Ayarları"
          aria-label="Yazıcı Ayarları"
        >
          <Printer className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
          <span className="hidden xl:inline">Yazıcı</span>
        </button>
        <button 
          onClick={() => { onToggleSound(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
          className="btn btn-sm btn-secondary flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold shadow-xs"
          style={{
            borderRadius: 'var(--radius-sm)',
            borderColor: soundEnabled ? 'var(--success-border)' : 'var(--border-subtle)',
            color: soundEnabled ? 'var(--success-text)' : 'var(--text-muted)'
          }}
          title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
          aria-label={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}</span>
        </button>
      </div>
    </div>
  );
};
