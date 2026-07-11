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
        className={`flex-1 bg-white rounded-2xl shadow-sm border p-6 xl:p-10 flex flex-col justify-center items-center relative overflow-hidden transition-colors ${!isInputFocused ? 'border-amber-400 border-4' : 'border-gray-200'}`}
        onClick={onFocusRequest}
      >
        {!isInputFocused && (
          <div className="absolute top-0 left-0 w-full bg-amber-100 text-amber-800 py-2 flex items-center justify-center gap-2 font-bold z-20">
            <AlertTriangle className="w-5 h-5" />
            <span>OKUTMA ODAĞI KAYBOLDU — Tıklayın veya F8'e basın</span>
          </div>
        )}
        <div className="text-gray-400 font-medium text-lg flex flex-col items-center gap-4">
          <TrendingUp className="w-16 h-16 opacity-50" />
          Okutmaya başlamak için sipariş ve ürün seçin
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex-1 bg-white rounded-2xl shadow-sm transition-all duration-300 p-6 xl:p-10 flex flex-col relative overflow-hidden cursor-default ${
        !isInputFocused 
          ? 'border-4 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]' 
          : isTargetReached
            ? 'border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)]'
            : 'border border-gray-200'
      }`}
      onClick={onFocusRequest}
    >
      {/* Odak Kaybı Uyarı Bandı */}
      {!isInputFocused && (
        <div className="absolute top-0 left-0 w-full bg-amber-500 text-white py-1.5 flex items-center justify-center gap-2 font-bold z-20 shadow-sm animate-pulse">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm md:text-base tracking-wide">OKUTMA ODAĞI KAYBOLDU — Tıklayın veya F8'e basın</span>
        </div>
      )}

      {/* Background Decoration */}
      <div className={`absolute -right-32 -top-32 w-96 h-96 rounded-full blur-3xl opacity-60 pointer-events-none transition-colors ${isTargetReached ? 'bg-green-50' : 'bg-blue-50'}`}></div>

      {/* Product Info */}
      <div className={`flex flex-col gap-3 z-10 ${!isInputFocused ? 'mt-8' : ''}`}>
        <span className={`text-xs font-bold tracking-widest uppercase self-start px-2 py-1 rounded ${isTargetReached ? 'text-green-600 bg-green-50' : 'text-blue-500 bg-blue-50'}`}>
          {isTargetReached ? 'HEDEF TAMAMLANDI' : 'Okutulan Ürün'}
        </span>
        <h2 
          className="text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-black text-gray-900 leading-tight line-clamp-2 break-words" 
          title={productName}
        >
          {productName}
        </h2>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="px-3 py-1 bg-gray-100 text-gray-600 font-mono font-bold rounded-lg text-sm md:text-lg border border-gray-200 shadow-sm">
            {stockCode}
          </span>
          <span className="px-3 py-1 text-gray-500 font-semibold rounded-lg text-xs md:text-sm bg-gray-50 border border-gray-100">
            {gtin}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[20px] md:min-h-[40px]"></div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-12 z-10">
        
        <div className="flex flex-col gap-1 p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wide">Beklenen</span>
          <span className="text-2xl md:text-4xl 2xl:text-5xl font-bold text-gray-500">{targetQty.toLocaleString()}</span>
        </div>

        <div className={`flex flex-col gap-1 p-3 md:p-4 rounded-xl border-2 shadow-sm ${isTargetReached ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <span className={`text-xs md:text-sm font-bold uppercase tracking-wide ${isTargetReached ? 'text-green-600' : 'text-blue-600'}`}>Okutulan</span>
          <span className={`text-3xl md:text-6xl 2xl:text-7xl font-black tracking-tighter ${isTargetReached ? 'text-green-600' : 'text-blue-600'}`}>
            {currentQty.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wide">Kalan</span>
          <span className="text-2xl md:text-4xl 2xl:text-5xl font-bold text-gray-700">{remainingQty.toLocaleString()}</span>
        </div>

      </div>

      {/* Progress Bar */}
      <div className="w-full flex flex-col gap-2 md:gap-3 z-10 shrink-0">
        <div className="flex justify-between items-end">
          <span className="font-bold text-gray-600 text-sm md:text-lg flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
            İlerleme
          </span>
          <span className={`text-2xl md:text-3xl font-black ${isTargetReached ? 'text-green-600' : 'text-blue-600'}`}>
            %{Math.round(progressPercent)}
          </span>
        </div>
        <div className="h-6 md:h-8 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
          <div 
            className={`h-full rounded-full relative transition-all duration-300 ${isTargetReached ? 'bg-green-500' : 'bg-blue-500'}`} 
            style={{ width: `${progressPercent}%` }}
          >
            {/* Diagonal stripes overlay */}
            <div 
              className="absolute inset-0 w-full h-full opacity-20" 
              style={{ 
                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,1) 50%, rgba(255,255,255,1) 75%, transparent 75%, transparent)', 
                backgroundSize: '2rem 2rem' 
              }}
            ></div>
          </div>
        </div>
      </div>

    </div>
  );
};
