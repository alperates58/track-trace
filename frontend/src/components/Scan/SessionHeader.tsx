import React from 'react';

interface SessionHeaderProps {
  isOnline: boolean;
  operatorName?: string;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({ isOnline, operatorName }) => {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800 m-0">Ürün Okutma Terminali</h1>
        <span className="text-sm text-gray-500 font-medium">Otomatik Koli Modu</span>
      </div>
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
          <span className={`text-xs font-bold ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
            {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </span>
        </div>
        {operatorName && (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50">
            <span className="text-sm font-bold text-gray-700">Operatör: {operatorName}</span>
          </div>
        )}
      </div>
    </header>
  );
};
