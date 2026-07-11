import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ArrowLeft, Loader2, Package, Layers } from 'lucide-react';
import { OrderLineDetailModal } from '../components/OrderLineDetailModal';

interface OrderGroupDetailProps {
  groupKey: string;
  onBack: () => void;
}

interface OrderGroupSummary {
  groupKey: string;
  orderNo: string;
  customerName: string;
  lineCount: number;
  distinctWorkOrderCount: number;
  totalExpectedQuantity: number;
  totalScannedQuantity: number;
  progressPercentage: number;
  statusSummary: string;
  lastActivityAt: string;
}

export const OrderGroupDetail: React.FC<OrderGroupDetailProps> = ({ groupKey, onBack }) => {
  const [summary, setSummary] = useState<OrderGroupSummary | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Line detail modal state
  const [selectedLine, setSelectedLine] = useState<any | null>(null);

  const fetchGroupDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryData = await api.get(`/api/order-groups/${encodeURIComponent(groupKey)}`);
      setSummary(summaryData);

      const linesData = await api.get(`/api/order-groups/${encodeURIComponent(groupKey)}/lines`);
      const newLines = Array.isArray(linesData) ? linesData : (linesData?.items ?? []);
      setLines(newLines);
      
      setSelectedLine((prev: any) => {
        if (!prev) return null;
        return newLines.find((l: any) => l.id === prev.id) || prev;
      });
    } catch (err: any) {
      setError(err.message || 'Grup detayları yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [groupKey]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Taslak': return <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Taslak</span>;
      case 'Aktif': return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>Aktif</span>;
      case 'Tamamlandı': return <span className="badge" style={{ backgroundColor: '#dcfce3', color: '#15803d' }}>Tamamlandı</span>;
      case 'İptal': return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>İptal</span>;
      
      // Original Order status fallbacks
      case 'Draft': return <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Taslak</span>;
      case 'Active': return <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>Aktif</span>;
      case 'Completed': return <span className="badge" style={{ backgroundColor: '#dcfce3', color: '#15803d' }}>Tamamlandı</span>;
      case 'Cancelled': return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>İptal</span>;
      
      default: return <span className="badge">{status}</span>;
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="spinner" size={40} /></div>;
  }

  if (error || !summary) {
    return (
      <div>
        <button className="btn" onClick={onBack} style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Geri Dön
        </button>
        <div style={{ padding: '20px', color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
          {error || 'Grup verisi bulunamadı.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button className="btn" onClick={onBack} style={{ marginRight: '16px', padding: '8px 12px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.75rem', margin: 0, color: '#0f172a', fontWeight: 700 }}>Sipariş Genel Detayı</h2>
          <p style={{ margin: 0, color: '#64748b' }}>{summary.orderNo} / {summary.customerName}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Toplam Hedef</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{summary.totalExpectedQuantity.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Okutulan</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7' }}>{summary.totalScannedQuantity.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>İlerleme</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: summary.progressPercentage === 100 ? '#10b981' : '#3b82f6' }}>%{summary.progressPercentage}</div>
          <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${summary.progressPercentage}%`, backgroundColor: summary.progressPercentage === 100 ? '#10b981' : '#3b82f6' }}></div>
          </div>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Ürün Satırları</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{summary.lineCount}</div>
        </div>
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>Ürün Satırları (İş Emirleri)</h3>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" style={{ margin: 0, minWidth: '1000px' }}>
          <thead style={{ backgroundColor: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '16px', color: '#475569' }}>Stok / Ürün</th>
              <th style={{ padding: '16px', color: '#475569' }}>İş Emri No</th>
              <th style={{ padding: '16px', color: '#475569' }}>Koli İçi / Palet İçi</th>
              <th style={{ padding: '16px', color: '#475569' }}>Miktar (Okutulan / Hedef)</th>
              <th style={{ padding: '16px', color: '#475569' }}>Durum</th>
              <th style={{ padding: '16px', textAlign: 'right', color: '#475569' }}>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Bu grupta ürün satırı bulunmuyor.</td></tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id} className="hover-row" onClick={() => setSelectedLine(line)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{line.productName || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{line.stockCode || '-'}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
                      {line.gtin}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={14} color="#64748b" /> {line.productPerCarton}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={14} color="#64748b" /> {line.cartonPerPallet}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px', minWidth: '180px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                      <span style={{ color: '#0284c7' }}>{line.scannedCount?.toLocaleString() || 0}</span>
                      <span style={{ color: '#64748b' }}>{line.expectedQuantity?.toLocaleString() || 0}</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min(100, Math.round(((line.scannedCount || 0) / (line.expectedQuantity || 1)) * 100))}%`, 
                        backgroundColor: line.status === 'Completed' ? '#10b981' : '#3b82f6' 
                      }}></div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {getStatusBadge(line.status)}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); setSelectedLine(line); }}>
                      Satır Detayı
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedLine && (
        <OrderLineDetailModal 
          selectedOrder={selectedLine} 
          onClose={() => setSelectedLine(null)} 
          onOrderUpdated={() => {
            fetchGroupDetails();
          }} 
        />
      )}
    </div>
  );
};
