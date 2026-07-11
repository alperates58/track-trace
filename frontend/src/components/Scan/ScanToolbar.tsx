import React, { useMemo } from 'react';
import { Camera, Printer, Volume2, VolumeX, Keyboard, MousePointerClick, ChevronDown } from 'lucide-react';
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
  onCloseFocusRestoration
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

  const selectedOrderDetails = uniqueOrderNos.find(o => o.orderNo === selectedOrderNo);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex gap-4 shrink-0 items-end overflow-visible">
      {/* İstasyon */}
      <div className="flex flex-col gap-1 shrink-0 w-32 md:w-40 relative">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">İstasyon</label>
        <div className="relative">
          <select 
            value={selectedStationId}
            onChange={(e) => {
              onStationChange(e.target.value);
              if (onCloseFocusRestoration) onCloseFocusRestoration();
            }}
            className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg py-2 pl-3 pr-8 text-sm font-semibold text-gray-800 cursor-pointer hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- SEÇ --</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Sipariş */}
      <div className="flex flex-col gap-1 shrink-0 w-40 md:w-56 relative">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">İş Emri / Sipariş</label>
        <div className="relative">
          <select 
            value={selectedOrderNo}
            onChange={(e) => {
              onOrderNoChange(e.target.value);
              if (onCloseFocusRestoration) onCloseFocusRestoration();
            }}
            className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg py-2 pl-3 pr-8 text-sm font-semibold text-gray-800 cursor-pointer hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
          >
            <option value="">-- SEÇ --</option>
            {uniqueOrderNos.map(o => (
              <option key={o.orderNo} value={o.orderNo}>
                {o.orderNo} {o.customerName ? `- ${o.customerName}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
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

      <div className="w-px h-10 bg-gray-200 mx-1 md:mx-2 mb-1 hidden sm:block"></div>

      {/* Odak Info */}
      <div 
        className="group relative flex items-center justify-center mb-1 mr-1 md:mr-2 cursor-pointer"
        onClick={onFocusRequest}
        title="Odağı geri almak için tıklayın veya F8'e basın"
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
          isInputFocused 
            ? 'bg-blue-50 text-blue-500 border border-blue-100 hover:bg-blue-100' 
            : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
        }`}>
          {isInputFocused ? <Keyboard className="w-4 h-4" /> : <MousePointerClick className="w-4 h-4" />}
        </div>
        <div className="absolute top-10 w-max bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {isInputFocused ? 'Odak Aktif (F8)' : 'Odak Kayboldu (Tıklayın / F8)'}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 mb-1">
        <button 
          onClick={() => { onOpenCamera(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          title="Kamera ile Okut"
          aria-label="Kamera ile Okut"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden xl:inline">Kamera</span>
        </button>
        <button 
          onClick={() => { onOpenPrinterSettings(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          title="Yazıcı Ayarları"
          aria-label="Yazıcı Ayarları"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden xl:inline">Yazıcı</span>
        </button>
        <button 
          onClick={() => { onToggleSound(); if (onCloseFocusRestoration) onCloseFocusRestoration(); }}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
            soundEnabled 
              ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100' 
              : 'bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200'
          }`}
          title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
          aria-label={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden lg:inline">{soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}</span>
        </button>
      </div>
    </div>
  );
};
