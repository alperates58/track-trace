import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Loader2, Package, Layers, Trash2 } from 'lucide-react';
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
  const { hasPermission } = useAuth();
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
      case 'Taslak':
      case 'Draft':
        return <span className="tt-badge tt-badge-neutral">Taslak</span>;
      case 'Aktif':
      case 'Active':
        return <span className="tt-badge tt-badge-primary">Aktif</span>;
      case 'Tamamlandı':
      case 'Completed':
        return <span className="tt-badge tt-badge-success">Tamamlandı</span>;
      case 'İptal':
      case 'Cancelled':
        return <span className="tt-badge tt-badge-danger">İptal</span>;
      default:
        return <span className="tt-badge tt-badge-neutral">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Loader2 className="spinner" size={32} />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={{ padding: '20px' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={15} style={{ marginRight: '6px' }} /> Geri Dön
        </button>
        <div style={{ padding: '16px', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
          {error || 'Grup verisi bulunamadı.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Title and Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px' }}>
            <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Geri
          </button>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)', fontWeight: 600 }}>
              Sipariş Detayı: <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{summary.orderNo}</span>
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{summary.customerName}</p>
          </div>
        </div>
        {hasPermission('orders.delete') && (
          <button
            className="btn"
            style={{ padding: '6px 14px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)', fontWeight: 500, fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={async () => {
              if (!window.confirm(`${summary.orderNo} (${summary.customerName}) sipariş grubunu ve ait tüm sipariş satırlarını silmek istediğinize emin misiniz?`)) return;
              try {
                await api.delete(`/api/order-groups/${encodeURIComponent(groupKey)}`);
                onBack();
              } catch (err: any) {
                alert(err.message || 'Sipariş grubu silinemedi.');
              }
            }}
          >
            <Trash2 size={14} /> Tüm Grubu Sil
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card-modern">
          <div className="stat-info">
            <span className="stat-title">Toplam Hedef</span>
            <div className="stat-value tabular-nums">{summary.totalExpectedQuantity.toLocaleString('tr-TR')}</div>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-info">
            <span className="stat-title">Okutulan</span>
            <div className="stat-value tabular-nums" style={{ color: 'var(--primary)' }}>{summary.totalScannedQuantity.toLocaleString('tr-TR')}</div>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-info">
            <span className="stat-title">İlerleme</span>
            <div className="stat-value tabular-nums" style={{ color: summary.progressPercentage === 100 ? 'var(--success)' : 'var(--primary)' }}>
              %{summary.progressPercentage}
            </div>
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${summary.progressPercentage}%`, backgroundColor: summary.progressPercentage === 100 ? 'var(--success)' : 'var(--primary)' }}></div>
            </div>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-info">
            <span className="stat-title">Ürün Satırları</span>
            <div className="stat-value tabular-nums">{summary.lineCount}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Ürün Satırları (İş Emirleri)</h3>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ padding: '10px 14px' }}>Stok / Ürün</th>
              <th style={{ padding: '10px 14px' }}>İş Emri No</th>
              <th style={{ padding: '10px 14px' }}>Koli İçi / Palet İçi</th>
              <th style={{ padding: '10px 14px' }}>Miktar (Okutulan / Hedef)</th>
              <th style={{ padding: '10px 14px' }}>Durum</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Bu grupta ürün satırı bulunmuyor.</td></tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id} className="hover-row" onClick={() => setSelectedLine(line)} style={{ cursor: 'pointer' }}>
                  <td data-label="Stok / Ürün" style={{ padding: '12px 14px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{line.productName || '-'}</div>
                      <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{line.stockCode || '-'}</div>
                    </div>
                  </td>
                  <td data-label="İş Emri No" style={{ padding: '12px 14px' }}>
                    <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-main)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', fontSize: '0.8125rem', border: '1px solid var(--border-subtle)' }}>
                      {line.gtin}
                    </span>
                  </td>
                  <td data-label="Koli İçi / Palet İçi" style={{ padding: '12px 14px' }}>
                    <div className="tabular-nums" style={{ display: 'flex', gap: '12px', fontSize: '0.8125rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={13} color="var(--text-muted)" /> {line.productPerCarton}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={13} color="var(--text-muted)" /> {line.cartonPerPallet}</span>
                    </div>
                  </td>
                  <td data-label="Miktar" style={{ padding: '12px 14px' }}>
                    <div className="progress-cell-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                      <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 500, width: '100%' }}>
                        <span style={{ color: 'var(--primary)' }}>{line.scannedCount?.toLocaleString('tr-TR') || 0}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{line.expectedQuantity?.toLocaleString('tr-TR') || 0}</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.min(100, Math.round(((line.scannedCount || 0) / (line.expectedQuantity || 1)) * 100))}%`, 
                          backgroundColor: line.status === 'Completed' ? 'var(--success)' : 'var(--primary)' 
                        }}></div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Durum" style={{ padding: '12px 14px' }}>
                    {getStatusBadge(line.status)}
                  </td>
                  <td data-label="Aksiyon" style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem', height: '28px' }} onClick={(e) => { e.stopPropagation(); setSelectedLine(line); }}>
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
