import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { 
  Clock, 
  Zap, 
  Award, 
  Package, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  User
} from 'lucide-react';
import { TTPageHeader, TTButton } from '../components/common';

export const PerformanceAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'cartons' | 'operators'>('orders');
  const [groupMode, setGroupMode] = useState<'stock' | 'order'>('stock');
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  
  // Tab 1: Orders Performance
  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  
  // Tab 2: Cartons Performance for selected Order
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>('');
  const [cartonDetails, setCartonDetails] = useState<any[]>([]);
  const [loadingCartons, setLoadingCartons] = useState(false);

  // Tab 3: Operators Performance
  const [operators, setOperators] = useState<any[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);

  // Helper time formatters
  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return '0 sn';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours} sa`);
    if (minutes > 0) parts.push(`${minutes} dk`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sn`);
    return parts.join(' ');
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/api/performance/summary');
      setSummary(res);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query = orderSearch ? `?search=${encodeURIComponent(orderSearch)}` : '';
      const res = await api.get(`/api/performance/orders${query}`);
      setOrders(res || []);
      if (!selectedOrderNo && res && res.length > 0) {
        setSelectedOrderNo(res[0].orderNo);
      }
    } catch (err) {
      console.error('Error fetching order performance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartonDetails = async (orderNo: string) => {
    if (!orderNo) return;
    setLoadingCartons(true);
    try {
      const res = await api.get(`/api/performance/orders/${encodeURIComponent(orderNo)}/cartons`);
      setCartonDetails(res || []);
    } catch (err) {
      console.error('Error fetching carton details:', err);
    } finally {
      setLoadingCartons(false);
    }
  };

  const fetchOperators = async () => {
    setLoadingOperators(true);
    try {
      const res = await api.get('/api/performance/operators');
      setOperators(res || []);
    } catch (err) {
      console.error('Error fetching operator performance:', err);
    } finally {
      setLoadingOperators(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderNo && activeTab === 'cartons') {
      fetchCartonDetails(selectedOrderNo);
    }
  }, [selectedOrderNo, activeTab]);

  useEffect(() => {
    if (activeTab === 'operators') {
      fetchOperators();
    }
  }, [activeTab]);

  const handleInspectCartons = (orderNo: string) => {
    setSelectedOrderNo(orderNo);
    setActiveTab('cartons');
  };

  // Grouped by OrderNo helper for Order-level aggregate view
  const getAggregatedOrders = () => {
    if (groupMode === 'stock') return orders;

    const map = new Map<string, any>();
    orders.forEach(o => {
      if (!map.has(o.orderNo)) {
        map.set(o.orderNo, {
          orderId: o.orderId,
          orderNo: o.orderNo,
          customerName: o.customerName,
          stockLinesCount: 1,
          stockCodes: [o.stockCode],
          expectedQuantity: o.expectedQuantity,
          totalCartons: o.totalCartons,
          totalScanned: o.totalScanned,
          firstScannedAt: o.firstScannedAt ? new Date(o.firstScannedAt) : null,
          lastScannedAt: o.lastScannedAt ? new Date(o.lastScannedAt) : null,
          status: o.status
        });
      } else {
        const item = map.get(o.orderNo);
        item.stockLinesCount += 1;
        item.stockCodes.push(o.stockCode);
        item.expectedQuantity += o.expectedQuantity;
        item.totalCartons += o.totalCartons;
        item.totalScanned += o.totalScanned;
        
        if (o.firstScannedAt) {
          const d = new Date(o.firstScannedAt);
          if (!item.firstScannedAt || d < item.firstScannedAt) item.firstScannedAt = d;
        }
        if (o.lastScannedAt) {
          const d = new Date(o.lastScannedAt);
          if (!item.lastScannedAt || d > item.lastScannedAt) item.lastScannedAt = d;
        }
      }
    });

    return Array.from(map.values()).map(item => {
      let durationSec = 0;
      if (item.firstScannedAt && item.lastScannedAt) {
        durationSec = Math.max(0, Math.floor((item.lastScannedAt.getTime() - item.firstScannedAt.getTime()) / 1000));
      }
      return {
        ...item,
        firstScannedAt: item.firstScannedAt ? item.firstScannedAt.toISOString() : null,
        lastScannedAt: item.lastScannedAt ? item.lastScannedAt.toISOString() : null,
        totalDurationSeconds: durationSec,
        avgSecondsPerCarton: item.totalCartons > 0 ? Math.round(durationSec / item.totalCartons) : 0
      };
    });
  };

  const displayedOrders = getAggregatedOrders();

  return (
    <div style={{ padding: '4px' }}>
      {/* Header */}
      <TTPageHeader
        title="Performans & Verimlilik Analizi"
        description="Sipariş tamamlanma süreleri, koli dolum hızları, koli arası bekleme süreleri ve operatör temposu takibi."
        actions={
          <TTButton variant="secondary" onClick={() => { fetchSummary(); fetchOrders(); }} icon={<RefreshCw size={14} className={loading ? 'spin-anim' : ''} />}>
            Yenile
          </TTButton>
        }
      />

      {/* KPI METRICS OVERVIEW GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* KPI 1 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Ort. Koli Dolum Süresi</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', color: 'var(--primary)', fontWeight: 800 }}>
                {formatDuration(summary?.overallAvgSecondsPerCarton || 0)}
              </h3>
            </div>
            <div style={{ backgroundColor: 'var(--primary-light)', padding: '10px', borderRadius: '8px' }}>
              <Clock size={22} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Her koli için ortalama okutma süresi</div>
        </div>

        {/* KPI 2 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Ort. Ürün Okutma Hızı</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', color: '#16a34a', fontWeight: 800 }}>
                {summary?.overallAvgSecondsPerItem ? `${summary.overallAvgSecondsPerItem.toFixed(1)} sn` : '0 sn'} / ürün
              </h3>
            </div>
            <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '8px' }}>
              <Zap size={22} color="#16a34a" />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ürün başına harcanan ortalama süre</div>
        </div>

        {/* KPI 3 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>En Hızlı Sipariş</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', color: '#0284c7', fontWeight: 800 }}>
                {summary?.fastestOrderNo || '-'}
              </h3>
            </div>
            <div style={{ backgroundColor: '#e0f2fe', padding: '10px', borderRadius: '8px' }}>
              <Award size={22} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Süre: {formatDuration(summary?.fastestOrderDurationSeconds || 0)}</div>
        </div>

        {/* KPI 4 */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Toplam Analiz Edilen Koli</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: 800 }}>
                {summary?.totalScannedCartons || 0} Koli
              </h3>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '8px' }}>
              <Package size={22} color="var(--text-main)" />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tamamlanan: {summary?.totalCompletedOrders || 0} sipariş</div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>
        <button
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'orders' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveTab('orders')}
        >
          ⏱️ Sipariş & Ürün Tamamlanma Süreleri
        </button>
        <button
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'cartons' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'cartons' ? 'var(--primary)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveTab('cartons')}
        >
          📦 Koli Bazlı Süre Analizi
        </button>
        <button
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'operators' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'operators' ? 'var(--primary)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveTab('operators')}
        >
          👥 Operatör Verimlilik Matrisi
        </button>
      </div>

      {/* TAB 1: ORDERS PERFORMANCE */}
      {activeTab === 'orders' && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          {/* Search Filter & View Mode Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Sipariş No, Müşteri, Stok Kodu veya Ürün Adı ara..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                style={{ padding: '10px 12px 10px 36px', width: '100%' }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            {/* View Mode Toggle: Stock Code Level vs Order Combined Level */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setGroupMode('stock')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: groupMode === 'stock' ? 700 : 500,
                  backgroundColor: groupMode === 'stock' ? '#ffffff' : 'transparent',
                  color: groupMode === 'stock' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: groupMode === 'stock' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer'
                }}
              >
                📦 Stok Kodu / Ürün Bazlı
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('order')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: groupMode === 'order' ? 700 : 500,
                  backgroundColor: groupMode === 'order' ? '#ffffff' : 'transparent',
                  color: groupMode === 'order' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: groupMode === 'order' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer'
                }}
              >
                📋 Sipariş Toplam Bazlı
              </button>
            </div>

            <button className="btn btn-primary" onClick={fetchOrders}>Filtrele</button>
          </div>

          {/* Orders Performance Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Sipariş No</th>
                  <th style={{ padding: '12px 16px' }}>Müşteri</th>
                  {groupMode === 'stock' ? (
                    <th style={{ padding: '12px 16px' }}>Stok Kodu & Ürün Adı</th>
                  ) : (
                    <th style={{ padding: '12px 16px' }}>Stok Kalemi</th>
                  )}
                  <th style={{ padding: '12px 16px' }}>Okutulan / Hedef</th>
                  <th style={{ padding: '12px 16px' }}>Koli Adedi</th>
                  <th style={{ padding: '12px 16px' }}>İlk Okutma</th>
                  <th style={{ padding: '12px 16px' }}>Son Okutma</th>
                  <th style={{ padding: '12px 16px' }}>Toplam Süre</th>
                  <th style={{ padding: '12px 16px' }}>Ort. Koli Süresi</th>
                  <th style={{ padding: '12px 16px' }}>Tempo</th>
                  <th style={{ padding: '12px 16px' }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Performans verisi bulunan sipariş bulunamadı.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((o: any, idx: number) => {
                    const hasScanned = o.totalScanned > 0 && o.totalCartons > 0 && o.avgSecondsPerCarton > 0;
                    const paceColor = !hasScanned ? '#64748b' : o.avgSecondsPerCarton <= 45 ? '#16a34a' : o.avgSecondsPerCarton <= 120 ? '#0284c7' : '#eab308';
                    const paceLabel = !hasScanned ? 'Henüz Başlamadı' : o.avgSecondsPerCarton <= 45 ? 'Yüksek Tempo' : o.avgSecondsPerCarton <= 120 ? 'Normal Tempo' : 'Orta Tempo';

                    return (
                      <tr key={o.orderId || `${o.orderNo}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td data-label="Sipariş No" style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                          {o.orderNo}
                        </td>
                        <td data-label="Müşteri" style={{ padding: '14px 16px' }}>
                          {o.customerName}
                        </td>

                        {groupMode === 'stock' ? (
                          <td data-label="Stok Kodu & Ürün Adı" style={{ padding: '14px 16px' }}>
                            <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '0.88rem' }}>{o.stockCode}</strong>
                            <span style={{ fontSize: '0.8rem', color: '#475569', display: 'inline-block', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.productName}>
                              {o.productName || 'Ürün Adı Belirtilmedi'}
                            </span>
                          </td>
                        ) : (
                          <td data-label="Stok Kalemi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                            <span className="badge badge-primary">{o.stockLinesCount} Farklı Stok Kodu</span>
                          </td>
                        )}

                        <td data-label="Okutulan / Hedef" style={{ padding: '14px 16px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--primary)' }}>{o.totalScanned.toLocaleString()}</span> / {o.expectedQuantity.toLocaleString()}
                        </td>
                        <td data-label="Koli Adedi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {o.totalCartons} Koli
                        </td>
                        <td data-label="İlk Okutma" style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {o.firstScannedAt ? new Date(o.firstScannedAt).toLocaleString() : '-'}
                        </td>
                        <td data-label="Son Okutma" style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {o.lastScannedAt ? new Date(o.lastScannedAt).toLocaleString() : '-'}
                        </td>
                        <td data-label="Toplam Süre" style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>
                          {formatDuration(o.totalDurationSeconds)}
                        </td>
                        <td data-label="Ort. Koli Süresi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {formatDuration(o.avgSecondsPerCarton)} / koli
                        </td>
                        <td data-label="Tempo" style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: `${paceColor}15`, color: paceColor, border: `1px solid ${paceColor}30` }}>
                            {paceLabel}
                          </span>
                        </td>
                        <td data-label="Aksiyon" style={{ padding: '14px 16px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleInspectCartons(o.orderNo)}
                          >
                            Koli Detayı <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CARTONS PERFORMANCE FOR SELECTED ORDER */}
      {activeTab === 'cartons' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Order Selector Banner */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Analiz Edilen Sipariş</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 800 }}>
                {selectedOrderNo || 'Sipariş Seçilmedi'}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sipariş Değiştir:</label>
              <select
                className="input-field"
                value={selectedOrderNo}
                onChange={(e) => setSelectedOrderNo(e.target.value)}
                style={{ padding: '8px 12px', flex: 1 }}
              >
                {orders.map((o) => (
                  <option key={o.orderNo} value={o.orderNo}>{o.orderNo} ({o.customerName})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cartons Table */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Koli Dolum & Bekleme Süreleri</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>En hızlı koli dolum süresine <strong>100 Puan</strong> verilir, diğer koliler bu benchmark süresine oranlanır.</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Koli No</th>
                    <th style={{ padding: '12px 16px' }}>SSCC</th>
                    <th style={{ padding: '12px 16px' }}>Ürün Adedi</th>
                    <th style={{ padding: '12px 16px', minWidth: '170px' }}>Koli Puanı (100 Puan)</th>
                    <th style={{ padding: '12px 16px' }}>İlk QR Okutma</th>
                    <th style={{ padding: '12px 16px' }}>Son QR Okutma</th>
                    <th style={{ padding: '12px 16px' }}>Dolum Süresi</th>
                    <th style={{ padding: '12px 16px' }}>Koli Arası Bekleme</th>
                    <th style={{ padding: '12px 16px' }}>Operatör</th>
                    <th style={{ padding: '12px 16px' }}>Hız Derecesi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCartons ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Koli süreleri yükleniyor...
                      </td>
                    </tr>
                  ) : cartonDetails.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Bu sipariş için koli detay verisi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const validCartonSecs = cartonDetails
                        .filter(c => c.actualQuantity > 0 && c.fillDurationSeconds > 0)
                        .map(c => c.fillDurationSeconds);
                      const minFillSec = validCartonSecs.length > 0 ? Math.min(...validCartonSecs) : 0;

                      return cartonDetails.map((c) => {
                        let score = 0;
                        let isBest = false;
                        if (c.fillDurationSeconds > 0 && c.actualQuantity > 0 && minFillSec > 0) {
                          score = Math.min(100, Math.round((minFillSec / c.fillDurationSeconds) * 1000) / 10);
                          if (Math.abs(c.fillDurationSeconds - minFillSec) < 0.1) {
                            score = 100;
                            isBest = true;
                          }
                        }

                        const scoreColor = isBest ? '#d97706' : score >= 80 ? '#16a34a' : score >= 60 ? '#0284c7' : score >= 40 ? '#eab308' : score > 0 ? '#dc2626' : '#64748b';
                        const paceColor = c.PaceCategory === 'Hızlı' ? '#16a34a' : c.PaceCategory === 'Normal' ? '#0284c7' : '#dc2626';

                        return (
                          <tr key={c.cartonId} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isBest ? '#fefce8' : 'transparent' }}>
                            <td data-label="Koli No" style={{ padding: '14px 16px', fontWeight: 700 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isBest && <span title="En Hızlı Koli Benchmark Lideri">🏆</span>}
                                {c.cartonNo}
                              </span>
                            </td>
                            <td data-label="SSCC" style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {c.sscc}
                            </td>
                            <td data-label="Ürün Adedi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                              {c.actualQuantity} Ürün
                            </td>

                            {/* 100-POINT CARTON SCORE */}
                            <td data-label="Koli Puanı" style={{ padding: '14px 16px' }}>
                              {score > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong style={{ fontSize: '0.9rem', color: scoreColor, width: '60px' }}>
                                    {score.toFixed(1)} / 100
                                  </strong>
                                  <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${score}%`, backgroundColor: scoreColor, borderRadius: '3px' }} />
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '10px' }}>
                                  Henüz İşlem Yok
                                </span>
                              )}
                            </td>

                            <td data-label="İlk QR Okutma" style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {c.firstScannedAt ? new Date(c.firstScannedAt).toLocaleTimeString() : '-'}
                            </td>
                            <td data-label="Son QR Okutma" style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {c.lastScannedAt ? new Date(c.lastScannedAt).toLocaleTimeString() : '-'}
                            </td>
                            <td data-label="Dolum Süresi" style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                              {formatDuration(c.fillDurationSeconds)}
                            </td>
                            <td data-label="Koli Arası Bekleme" style={{ padding: '14px 16px', color: c.idleSecondsFromPrevious > 60 ? '#dc2626' : 'var(--text-muted)' }}>
                              {c.idleSecondsFromPrevious > 0 ? formatDuration(c.idleSecondsFromPrevious) : '-'}
                            </td>
                            <td data-label="Operatör" style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                              {c.operatorName || 'Operatör'}
                            </td>
                            <td data-label="Hız Derecesi" style={{ padding: '14px 16px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: `${paceColor}15`, color: paceColor, border: `1px solid ${paceColor}30` }}>
                                {isBest ? '🏆 En Hızlı Koli' : c.paceCategory} ({formatDuration(c.fillDurationSeconds)})
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPERATORS PERFORMANCE MATRIX */}
      {activeTab === 'operators' && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Operatör Performans & 100 Puan Skor Matrisi
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Sistemdeki en hızlı ortalama koli okutma süresini gerçekleştiren operatör <strong>100 Puan (Benchmark Lideri)</strong> kabul edilir ve diğer operatörler bu sürece oranlanarak 100 üzerinden puanlanır.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Operatör Adı</th>
                  <th style={{ padding: '12px 16px', minWidth: '180px' }}>Performans Skoru (100 Puan)</th>
                  <th style={{ padding: '12px 16px' }}>Okutulan Koli</th>
                  <th style={{ padding: '12px 16px' }}>Okutulan QR</th>
                  <th style={{ padding: '12px 16px' }}>Dakikadaki Hız</th>
                  <th style={{ padding: '12px 16px' }}>Ortalama Koli Süresi</th>
                  <th style={{ padding: '12px 16px' }}>Performans Derecesi</th>
                </tr>
              </thead>
              <tbody>
                {loadingOperators ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Operatör verileri yükleniyor...
                    </td>
                  </tr>
                ) : operators.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Operatör verisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  operators.map((op, idx) => {
                    const isLeader = op.isBenchmarkLeader || op.score === 100;
                    const scoreColor = isLeader ? '#d97706' : op.score >= 80 ? '#16a34a' : op.score >= 60 ? '#0284c7' : op.score >= 40 ? '#eab308' : '#dc2626';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isLeader ? '#fefce8' : 'transparent' }}>
                        <td data-label="Operatör Adı" style={{ padding: '14px 16px', fontWeight: 700 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isLeader ? (
                              <span style={{ fontSize: '1.2rem' }} title="Benchmark Lideri">🏆</span>
                            ) : (
                              <User size={16} color="var(--primary)" />
                            )}
                            <span style={{ color: isLeader ? '#854d0e' : 'var(--text-main)' }}>{op.operatorName}</span>
                          </span>
                        </td>

                        {/* 100-POINT SCORE & PROGRESS BAR */}
                        <td data-label="Performans Skoru" style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ fontSize: '1rem', color: scoreColor, width: '65px' }}>
                              {op.score ? `${op.score.toFixed(1)}` : '0'} / 100
                            </strong>
                            <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, op.score || 0)}%`, backgroundColor: scoreColor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        </td>

                        <td data-label="Okutulan Koli" style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {op.totalCartons} Koli
                        </td>
                        <td data-label="Okutulan QR" style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                          {op.totalScannedItems.toLocaleString()} QR
                        </td>
                        <td data-label="Dakikadaki Hız" style={{ padding: '14px 16px', fontWeight: 700, color: '#16a34a' }}>
                          {op.itemsPerMinute} Ürün / dk
                        </td>
                        <td data-label="Ort. Koli Süresi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {formatDuration(op.avgSecondsPerCarton)} / koli
                        </td>
                        <td data-label="Performans Derecesi" style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            backgroundColor: `${scoreColor}15`,
                            color: scoreColor,
                            border: `1px solid ${scoreColor}30`
                          }}>
                            {op.scoreGrade || 'Standart'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
