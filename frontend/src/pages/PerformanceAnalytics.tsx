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
          ⏱️ Sipariş Tamamlanma Süreleri
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
          {/* Search Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Sipariş No, Müşteri veya Stok No ara..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                style={{ padding: '10px 12px 10px 36px', width: '100%' }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
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
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Performans verisi bulunan sipariş bulunamadı.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const paceColor = o.AvgSecondsPerCarton <= 45 ? '#16a34a' : o.AvgSecondsPerCarton <= 120 ? '#0284c7' : '#eab308';
                    const paceLabel = o.AvgSecondsPerCarton <= 45 ? 'Yüksek Tempo' : o.AvgSecondsPerCarton <= 120 ? 'Normal Tempo' : 'Orta Tempo';

                    return (
                      <tr key={o.orderId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td data-label="Sipariş No" style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                          {o.orderNo}
                        </td>
                        <td data-label="Müşteri" style={{ padding: '14px 16px' }}>
                          {o.customerName}
                        </td>
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
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Koli Dolum & Bekleme Süreleri</h4>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Koli No</th>
                    <th style={{ padding: '12px 16px' }}>SSCC</th>
                    <th style={{ padding: '12px 16px' }}>Ürün Adedi</th>
                    <th style={{ padding: '12px 16px' }}>İlk QR Okutma</th>
                    <th style={{ padding: '12px 16px' }}>Son QR Okutma</th>
                    <th style={{ padding: '12px 16px' }}>Dolum Süresi</th>
                    <th style={{ padding: '12px 16px' }}>Koli Arası Bekleme</th>
                    <th style={{ padding: '12px 16px' }}>Operatör</th>
                    <th style={{ padding: '12px 16px' }}>Dolum Hızı</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCartons ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Koli süreleri yükleniyor...
                      </td>
                    </tr>
                  ) : cartonDetails.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Bu sipariş için koli detay verisi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    cartonDetails.map((c) => {
                      const paceColor = c.PaceCategory === 'Hızlı' ? '#16a34a' : c.PaceCategory === 'Normal' ? '#0284c7' : '#dc2626';

                      return (
                        <tr key={c.cartonId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td data-label="Koli No" style={{ padding: '14px 16px', fontWeight: 700 }}>
                            {c.cartonNo}
                          </td>
                          <td data-label="SSCC" style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {c.sscc}
                          </td>
                          <td data-label="Ürün Adedi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                            {c.actualQuantity} Ürün
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
                          <td data-label="Dolum Hızı" style={{ padding: '14px 16px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: `${paceColor}15`, color: paceColor, border: `1px solid ${paceColor}30` }}>
                              {c.paceCategory} ({formatDuration(c.fillDurationSeconds)})
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
        </div>
      )}

      {/* TAB 3: OPERATORS PERFORMANCE MATRIX */}
      {activeTab === 'operators' && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Operatör Okutma Hız & Verimlilik Matrisi</h4>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Operatör Adı</th>
                  <th style={{ padding: '12px 16px' }}>Toplam Okutulan Koli</th>
                  <th style={{ padding: '12px 16px' }}>Toplam Okutulan QR</th>
                  <th style={{ padding: '12px 16px' }}>Dakikadaki Ürün Hızı</th>
                  <th style={{ padding: '12px 16px' }}>Ortalama Koli Dolum Süresi</th>
                  <th style={{ padding: '12px 16px' }}>Verimlilik Durumu</th>
                </tr>
              </thead>
              <tbody>
                {loadingOperators ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Operatör verileri yükleniyor...
                    </td>
                  </tr>
                ) : operators.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Operatör verisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  operators.map((op, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td data-label="Operatör Adı" style={{ padding: '14px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} color="var(--primary)" /> {op.operatorName}
                      </td>
                      <td data-label="Toplam Okutulan Koli" style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {op.totalCartons} Koli
                      </td>
                      <td data-label="Toplam Okutulan QR" style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                        {op.totalScannedItems.toLocaleString()} QR
                      </td>
                      <td data-label="Dakikadaki Ürün Hızı" style={{ padding: '14px 16px', fontWeight: 700, color: '#16a34a' }}>
                        {op.itemsPerMinute} Ürün / dk
                      </td>
                      <td data-label="Ort. Koli Dolum Süresi" style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {formatDuration(op.avgSecondsPerCarton)} / koli
                      </td>
                      <td data-label="Verimlilik Durumu" style={{ padding: '14px 16px' }}>
                        <span className="badge badge-success">Yüksek Performans</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
