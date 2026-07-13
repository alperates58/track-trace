import React from 'react';
import { Check, X, History } from 'lucide-react';

export interface ScanHistoryItem {
  rawCode: string;
  gtin: string;
  serialNo: string;
  status: string; // 'Başarılı' | 'Hata' | vb.
  timestamp: string;
  cartonNo: string;
}

interface RecentScanPanelProps {
  history: ScanHistoryItem[];
  errorMsg?: string;
}

export const RecentScanPanel: React.FC<RecentScanPanelProps> = ({ history, errorMsg }) => {
  return (
    <div className="scan-history-panel w-full lg:w-[350px] 2xl:w-[450px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden shrink-0 h-full">
      <div className="p-3 md:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
          <h3 className="font-bold text-gray-800 text-base md:text-lg">Geçmiş</h3>
        </div>
        <span className="text-[10px] md:text-xs font-bold bg-white border border-gray-200 text-gray-500 px-2 py-1 rounded-md shadow-sm">
          Son 10 Okuma
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 md:p-3 flex flex-col gap-2 no-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <History className="w-12 h-12 opacity-20" />
            <span className="text-sm font-medium">Oturumda okuma yapılmadı</span>
          </div>
        ) : (
          history.map((item, idx) => {
            const isSuccess = item.status === 'Başarılı';
            const isLatestError = !isSuccess && idx === 0;
            // Opacity decreases slightly for older items
            const opacityClass = idx === 0 ? 'opacity-100' : idx < 3 ? 'opacity-90' : idx < 6 ? 'opacity-70' : 'opacity-50';
            
            // Generate detailed error msg if this is the latest and we have a global errorMsg
            const displayMsg = !isSuccess ? (isLatestError && errorMsg ? errorMsg : item.status) : 'Başarılı Okuma';

            return (
              <div 
                key={`${item.rawCode}-${item.timestamp}-${idx}`} 
                className={`flex items-center gap-3 p-2 md:p-3 rounded-xl shadow-sm border transition-all ${opacityClass} ${
                  isSuccess 
                    ? idx === 0 ? 'bg-green-50/80 border-green-200' : 'bg-white border-gray-100' 
                    : isLatestError ? 'bg-red-50 border-red-200' : 'bg-white border-red-100'
                }`}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isSuccess 
                    ? idx === 0 ? 'bg-green-500 text-white shadow-[0_2px_10px_-2px_rgba(34,197,94,0.5)]' : 'bg-gray-100 text-green-500' 
                    : isLatestError ? 'bg-red-500 text-white shadow-[0_2px_10px_-2px_rgba(239,68,68,0.5)]' : 'bg-red-50 text-red-400'
                }`}>
                  {isSuccess ? <Check className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" /> : <X className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <span 
                    className={`font-mono font-bold text-base md:text-lg lg:text-xl truncate ${
                      isSuccess ? (idx === 0 ? 'text-gray-900' : 'text-gray-600') : (isLatestError ? 'text-red-900 line-through opacity-70' : 'text-gray-500 line-through')
                    }`}
                    title={item.rawCode}
                  >
                    {item.rawCode}
                  </span>
                  <span 
                    className={`text-[10px] md:text-xs font-bold truncate ${
                      isSuccess ? (idx === 0 ? 'text-green-700' : 'text-gray-400') : (isLatestError ? 'text-red-700 uppercase tracking-wide' : 'text-red-400')
                    }`}
                    title={displayMsg}
                  >
                    {displayMsg}
                  </span>
                </div>
                
                <span className={`text-xs md:text-sm font-bold bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm ${
                  isSuccess ? 'text-gray-400' : 'text-red-400'
                }`}>
                  {item.timestamp}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
