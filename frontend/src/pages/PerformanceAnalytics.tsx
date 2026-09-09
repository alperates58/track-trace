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
  User,
  Coffee,
  Layers,
  Calendar
} from 'lucide-react';
import { 
  TTPageHeader, 
  TTButton, 
  TTBadge, 
  TTDrawer, 
  TTStatCard, 
  TTProgressBar, 
  TTEmptyState, 
  TTLoadingState, 
  TTAlert, 
  TTCard 
} from '../components/common';

interface OrderPerformance {
  orderId: string;
  orderNo: string;
  customerName: string;
  stockCode: string;
  productName: string;
  expectedQuantity: number;
  totalCartons: number;
  totalScanned: number;
  firstScannedAt: string | null;
  lastScannedAt: string | null;
  totalDurationSeconds: number;
  netDurationSeconds: number;
  idlePauseSeconds: number;
  avgSecondsPerItem: number;
  avgSecondsPerCarton: number;
  hasPauseBreak: boolean;
  status: string;
}

interface CartonPerformance {
  cartonId: string;
  cartonNo: string;
  sscc: string;
  actualQuantity: number;
  gtin: string | null;
  firstScannedAt: string | null;
  lastScannedAt: string | null;
  fillDurationSeconds: number;
  idleSecondsFromPrevious: number;
  isPauseBreak: boolean;
  operatorName: string | null;
  paceCategory: string;
}

interface PerformanceSummary {
  overallAvgSecondsPerCarton: number;
  overallAvgSecondsPerItem: number;
  totalCompletedOrders: number;
  totalScannedCartons: number;
  fastestOrderNo: string;
  fastestOrderDurationSeconds: number;
  totalIdlePauseSeconds: number;
}

interface OperatorPerformance {
  operatorName: string;
  totalCartons: number;
  totalScannedItems: number;
  avgSecondsPerCarton: number;
  itemsPerMinute: number;
  score: number;
  isBenchmarkLeader: boolean;
  scoreGrade: string;
}

type DateFilterKey = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export const PerformanceAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'operators'>('orders');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  
  // Summary & Stats
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  
  // Orders State
  const [orders, setOrders] = useState<OrderPerformance[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Operators State
  const [operators, setOperators] = useState<OperatorPerformance[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);

  // Drawer: Carton Timeline
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderPerformance | null>(null);
  const [cartonDetails, setCartonDetails] = useState<CartonPerformance[]>([]);
  const [loadingCartons, setLoadingCartons] = useState(false);

  // Helper date range calculator
  const getDateRange = (key: DateFilterKey): { from: string | null; to: string | null } => {
    const now = new Date();
    if (key === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (key === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (key === 'week') {
      const start = new Date(now);
      const day = (now.getDay() + 6) % 7; // Monday = 0
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (key === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    return { from: null, to: null };
  };

  // Duration Formatter
  const formatDuration = (totalSeconds: number | null | undefined) => {
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

  const formatShortDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchSummary = async (dateKey = dateFilter) => {
    try {
      const { from, to } = getDateRange(dateKey);
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<PerformanceSummary>(`/api/performance/summary${qs}`);
      setSummary(res);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const fetchOrders = async (dateKey = dateFilter, searchVal = orderSearch) => {
    setLoadingOrders(true);
    try {
      const { from, to } = getDateRange(dateKey);
      const params = new URLSearchParams();
      if (searchVal.trim()) params.append('search', searchVal.trim());
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<OrderPerformance[]>(`/api/performance/orders${qs}`);
      setOrders(res || []);
    } catch (err) {
      console.error('Error fetching order performance:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchCartonDetails = async (orderNo: string) => {
    if (!orderNo) return;
    setLoadingCartons(true);
    try {
      const res = await api.get<CartonPerformance[]>(`/api/performance/orders/${encodeURIComponent(orderNo)}/cartons`);
      setCartonDetails(res || []);
    } catch (err) {
      console.error('Error fetching carton details:', err);
    } finally {
      setLoadingCartons(false);
    }
  };

  const fetchOperators = async (dateKey = dateFilter) => {
    setLoadingOperators(true);
    try {
      const { from, to } = getDateRange(dateKey);
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<OperatorPerformance[]>(`/api/performance/operators${qs}`);
      setOperators(res || []);
    } catch (err) {
      console.error('Error fetching operator performance:', err);
    } finally {
      setLoadingOperators(false);
    }
  };

  useEffect(() => {
    fetchSummary('all');
    fetchOrders('all', '');
  }, []);

  const handleDateFilterChange = (key: DateFilterKey) => {
    setDateFilter(key);
    fetchSummary(key);
    if (activeTab === 'orders') {
      fetchOrders(key, orderSearch);
    } else {
      fetchOperators(key);
    }
  };

  const handleTabChange = (tab: 'orders' | 'operators') => {
    setActiveTab(tab);
    if (tab === 'orders') {
      fetchOrders(dateFilter, orderSearch);
    } else {
      fetchOperators(dateFilter);
    }
  };

  const handleOpenDrawer = (order: OrderPerformance) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
    fetchCartonDetails(order.orderNo);
  };

  // Carton benchmark leader calculations for Drawer
  const validCartonSecs = cartonDetails
    .filter(c => c.actualQuantity > 0 && c.fillDurationSeconds > 0)
    .map(c => c.fillDurationSeconds);
  const minCartonSec = validCartonSecs.length > 0 ? Math.min(...validCartonSecs) : 0;

  return (
    <div style={{ padding: '4px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <TTPageHeader
        title="Performans & Verimlilik Analizi"
        description="Gerçek net çalışma süreleri, koli dolum hızları, tespit edilen vardiya molaları ve operatör benchmark skorları."
        actions={
          <TTButton 
            variant="secondary" 
            onClick={() => { 
              fetchSummary(dateFilter); 
              if (activeTab === 'orders') fetchOrders(dateFilter, orderSearch); 
              else fetchOperators(dateFilter); 
            }} 
            icon={<RefreshCw size={14} className={loadingOrders || loadingOperators ? 'spin-anim' : ''} />}
          >
            Yenile
          </TTButton>
        }
      />

      {/* QUICK DATE FILTER BAR */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '12px',
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-md)', 
        padding: '10px 16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="var(--primary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Zaman Filtresi:</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(
            [
              { key: 'all', label: 'Tüm Zamanlar' },
              { key: 'today', label: 'Bugün' },
              { key: 'yesterday', label: 'Dün' },
              { key: 'week', label: 'Bu Hafta' },
              { key: 'month', label: 'Bu Ay' }
            ] as const
          ).map(filter => {
            const isActive = dateFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleDateFilterChange(filter.key)}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-main)',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <TTStatCard
          title="Net Ort. Koli Dolumu"
          value={formatDuration(summary?.overallAvgSecondsPerCarton || 0)}
          icon={<Clock size={20} />}
          color="var(--primary)"
        />
        <TTStatCard
          title="Ort. Ürün Okuma Hızı"
          value={summary?.overallAvgSecondsPerItem ? `${summary.overallAvgSecondsPerItem.toFixed(1)} sn / ürün` : '0 sn'}
          icon={<Zap size={20} />}
          color="#16a34a"
        />
        <TTStatCard
          title="En Hızlı Tamamlanan"
          value={summary?.fastestOrderNo || '-'}
          icon={<Award size={20} />}
          color="#0284c7"
        />
        <TTStatCard
          title="Analiz Edilen Koli"
          value={`${summary?.totalScannedCartons || 0} Koli`}
          icon={<Package size={20} />}
          color="#8b5cf6"
        />
      </div>

      {/* DOWNTIME / SHIFT BREAK CALLOUT BANNER IF DETECTED */}
      {summary?.totalIdlePauseSeconds && summary.totalIdlePauseSeconds > 600 ? (
        <div style={{ marginBottom: '20px' }}>
          <TTAlert variant="info" title="Net Süre Ayrıştırması Aktif">
            Vardiya sonu, gece molası ve 10 dakikadan uzun duruşlar ({formatDuration(summary.totalIdlePauseSeconds)}) otomatik tespit edilerek 
            net koli dolum hızından düşülmüştür. Bu sayede ertesi güne sarkan siparişler gerçekçi hızla ölçülür.
          </TTAlert>
        </div>
      ) : null}

      {/* NAVIGATION TABS */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border-color)', 
        marginBottom: '20px', 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: 'var(--radius-md)', 
        padding: '4px 8px' 
      }}>
        <button
          style={{
            padding: '12px 24px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'orders' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => handleTabChange('orders')}
        >
          <Clock size={16} />
          Sipariş & Hız Analizi
        </button>
        <button
          style={{
            padding: '12px 24px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'operators' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'operators' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => handleTabChange('operators')}
        >
          <User size={16} />
          Operatör Verimlilik Matrisi
        </button>
      </div>

      {/* TAB 1: ORDERS PERFORMANCE */}
      {activeTab === 'orders' && (
        <TTCard padding="lg">
          {/* Search bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Sipariş No, Müşteri, Stok Kodu veya Ürün Adı ile ara..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchOrders(dateFilter, orderSearch); }}
                style={{ padding: '10px 14px 10px 38px', width: '100%' }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <TTButton variant="primary" onClick={() => fetchOrders(dateFilter, orderSearch)}>
              Ara
            </TTButton>
            {orderSearch && (
              <TTButton variant="secondary" onClick={() => { setOrderSearch(''); fetchOrders(dateFilter, ''); }}>
                Temizle
              </TTButton>
            )}
          </div>

          {/* Table */}
          {loadingOrders ? (
            <TTLoadingState text="Sipariş performans verileri hesaplanıyor..." />
          ) : orders.length === 0 ? (
            <TTEmptyState
              icon={<Layers size={40} color="var(--text-muted)" />}
              title="Performans Verisi Bulunamadı"
              description="Seçilen tarih aralığında ve arama kriterlerinde okutma verisi bulunan sipariş bulunmamaktadır."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Sipariş & Müşteri</th>
                    <th style={{ padding: '12px 16px' }}>İlerleme & Koliler</th>
                    <th style={{ padding: '12px 16px' }}>Tarih Aralığı</th>
                    <th style={{ padding: '12px 16px' }}>Net Çalışma Süresi</th>
                    <th style={{ padding: '12px 16px' }}>Koli Başına Hız</th>
                    <th style={{ padding: '12px 16px' }}>Tempo</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const hasScanned = o.totalScanned > 0 && o.totalCartons > 0 && o.avgSecondsPerCarton > 0;
                    const progressPct = o.expectedQuantity > 0 ? Math.min(100, Math.round((o.totalScanned / o.expectedQuantity) * 100)) : 0;
                    
                    let paceVariant: 'success' | 'info' | 'warning' | 'neutral' = 'neutral';
                    let paceLabel = 'Henüz Başlamadı';
                    if (hasScanned) {
                      if (o.avgSecondsPerCarton <= 45) {
                        paceVariant = 'success';
                        paceLabel = 'Yüksek Tempo';
                      } else if (o.avgSecondsPerCarton <= 120) {
                        paceVariant = 'info';
                        paceLabel = 'Normal Tempo';
                      } else {
                        paceVariant = 'warning';
                        paceLabel = 'Orta / Yavaş';
                      }
                    }

                    return (
                      <tr 
                        key={o.orderId || o.orderNo} 
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                        onClick={() => handleOpenDrawer(o)}
                      >
                        {/* 1. Sipariş & Müşteri */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                            {o.orderNo}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '2px', fontWeight: 600 }}>
                            {o.customerName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{o.stockCode}</span>
                            <span style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.productName}>
                              {o.productName}
                            </span>
                          </div>
                        </td>

                        {/* 2. İlerleme & Koliler */}
                        <td style={{ padding: '14px 16px', minWidth: '160px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                            <span>{o.totalScanned.toLocaleString()} / {o.expectedQuantity.toLocaleString()}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{o.totalCartons} Koli</span>
                          </div>
                          <TTProgressBar progress={progressPct} color={progressPct === 100 ? '#16a34a' : 'var(--primary)'} />
                        </td>

                        {/* 3. Tarih Aralığı */}
                        <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <div><strong style={{ color: 'var(--text-main)' }}>İlk:</strong> {formatShortDate(o.firstScannedAt)}</div>
                          <div style={{ marginTop: '2px' }}><strong style={{ color: 'var(--text-main)' }}>Son:</strong> {formatShortDate(o.lastScannedAt)}</div>
                        </td>

                        {/* 4. Net Çalışma Süresi */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            {formatDuration(o.netDurationSeconds)}
                          </div>
                          {o.hasPauseBreak && (
                            <div 
                              title="Bu siparişte vardiya veya gece duruşu tespit edildi ve net süreden düşüldü"
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '0.72rem', 
                                color: '#b45309', 
                                backgroundColor: '#fef3c7', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                marginTop: '4px',
                                fontWeight: 600
                              }}
                            >
                              <Coffee size={12} />
                              +{formatDuration(o.idlePauseSeconds)} mola/gece
                            </div>
                          )}
                        </td>

                        {/* 5. Koli Başına Hız */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: hasScanned ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {hasScanned ? `${formatDuration(o.avgSecondsPerCarton)} / koli` : '-'}
                          </div>
                          {hasScanned && o.avgSecondsPerItem > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              ({o.avgSecondsPerItem.toFixed(1)} sn / adet)
                            </div>
                          )}
                        </td>

                        {/* 6. Tempo */}
                        <td style={{ padding: '14px 16px' }}>
                          <TTBadge variant={paceVariant} size="sm">
                            {paceLabel}
                          </TTBadge>
                        </td>

                        {/* 7. Aksiyon */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <TTButton
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(o);
                            }}
                            icon={<ChevronRight size={14} />}
                          >
                            Koli Çizelgesi
                          </TTButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TTCard>
      )}

      {/* TAB 2: OPERATORS MATRIX */}
      {activeTab === 'operators' && (
        <TTCard padding="lg">
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Operatör Performans & Benchmark Skorları
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              En yüksek koli dolum hızına sahip operatör <strong>100 Puan (Benchmark Lideri)</strong> kabul edilir. Gece duruşları süreden düşülerek net aktif okuma hızı hesaplanır.
            </p>
          </div>

          {loadingOperators ? (
            <TTLoadingState text="Operatör verileri yükleniyor..." />
          ) : operators.length === 0 ? (
            <TTEmptyState
              icon={<User size={40} color="var(--text-muted)" />}
              title="Operatör Verisi Bulunamadı"
              description="Seçilen tarih aralığında operatör okutma kaydı bulunamadı."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Operatör Adı</th>
                    <th style={{ padding: '12px 16px', minWidth: '190px' }}>Benchmark Skoru (100 Puan)</th>
                    <th style={{ padding: '12px 16px' }}>Okutulan Koli</th>
                    <th style={{ padding: '12px 16px' }}>Okutulan QR</th>
                    <th style={{ padding: '12px 16px' }}>Dakikadaki Okutma Hızı</th>
                    <th style={{ padding: '12px 16px' }}>Ort. Koli Süresi</th>
                    <th style={{ padding: '12px 16px' }}>Performans Durumu</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op, idx) => {
                    const isLeader = op.isBenchmarkLeader || op.score === 100;
                    const scoreColor = isLeader ? '#d97706' : op.score >= 80 ? '#16a34a' : op.score >= 60 ? '#0284c7' : op.score >= 40 ? '#eab308' : '#dc2626';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isLeader ? '#fefce8' : 'transparent' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isLeader ? (
                              <span style={{ fontSize: '1.2rem' }} title="Benchmark Lideri">🏆</span>
                            ) : (
                              <User size={16} color="var(--primary)" />
                            )}
                            <span style={{ color: isLeader ? '#854d0e' : 'var(--text-main)' }}>{op.operatorName}</span>
                          </span>
                        </td>

                        {/* Benchmark Bar */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ fontSize: '0.95rem', color: scoreColor, width: '65px' }}>
                              {op.score ? op.score.toFixed(1) : '0'} / 100
                            </strong>
                            <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  height: '100%', 
                                  width: `${Math.min(100, op.score || 0)}%`, 
                                  backgroundColor: scoreColor, 
                                  borderRadius: '4px', 
                                  transition: 'width 0.4s ease' 
                                }} 
                              />
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {op.totalCartons} Koli
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                          {op.totalScannedItems.toLocaleString()} QR
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#16a34a' }}>
                          {op.itemsPerMinute} Ürün / dk
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {formatDuration(op.avgSecondsPerCarton)} / koli
                        </td>
                        <td style={{ padding: '14px 16px' }}>
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TTCard>
      )}

      {/* DRAWER: Koli Zaman Çizelgesi & Detay */}
      <TTDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`Koli Zaman Çizelgesi: ${selectedOrder?.orderNo || ''}`}
        width="620px"
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header info */}
            <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {selectedOrder.customerName}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedOrder.stockCode} - {selectedOrder.productName}
                  </div>
                </div>
                <TTBadge variant={selectedOrder.status === 'Completed' ? 'success' : 'info'}>
                  {selectedOrder.status}
                </TTBadge>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '12px', fontSize: '0.82rem' }}>
                <div><strong>Koli Adedi:</strong> {selectedOrder.totalCartons} Koli</div>
                <div><strong>Ürün Adedi:</strong> {selectedOrder.totalScanned} / {selectedOrder.expectedQuantity}</div>
                <div><strong>Net Çalışma Süresi:</strong> {formatDuration(selectedOrder.netDurationSeconds)}</div>
                <div><strong>Koli Başına Hız:</strong> {formatDuration(selectedOrder.avgSecondsPerCarton)} / koli</div>
              </div>
            </div>

            {/* Shift break alert banner */}
            {selectedOrder.hasPauseBreak && (
              <TTAlert variant="warning" title="Vardiya / Gece Duruşu Tespit Edildi">
                Bu siparişte toplam <strong>{formatDuration(selectedOrder.idlePauseSeconds)}</strong> süren duruş veya vardiya molası 
                tespit edildi ve koli dolum hızını yanıltmaması için net süreden düşüldü.
              </TTAlert>
            )}

            {/* Carton Timeline Cards */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Koli Bazlı Dolum Sıralaması ({cartonDetails.length} Koli)
                </h5>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kronolojik Sıra</span>
              </div>

              {loadingCartons ? (
                <TTLoadingState text="Koli verileri yükleniyor..." />
              ) : cartonDetails.length === 0 ? (
                <TTEmptyState
                  icon={<Package size={32} color="var(--text-muted)" />}
                  title="Koli Detayı Bulunamadı"
                  description="Bu sipariş için henüz taranmış koli verisi bulunmamaktadır."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cartonDetails.map((c, idx) => {
                    let score = 0;
                    let isBest = false;
                    if (c.fillDurationSeconds > 0 && c.actualQuantity > 0 && minCartonSec > 0) {
                      score = Math.min(100, Math.round((minCartonSec / c.fillDurationSeconds) * 1000) / 10);
                      if (Math.abs(c.fillDurationSeconds - minCartonSec) < 0.1) {
                        score = 100;
                        isBest = true;
                      }
                    }

                    const scoreColor = isBest ? '#d97706' : score >= 80 ? '#16a34a' : score >= 60 ? '#0284c7' : score >= 40 ? '#eab308' : '#dc2626';
                    const paceColor = c.paceCategory === 'Hızlı' ? '#16a34a' : c.paceCategory === 'Normal' ? '#0284c7' : '#dc2626';

                    return (
                      <React.Fragment key={c.cartonId || idx}>
                        {/* If previous carton was followed by a break > 10m */}
                        {c.isPauseBreak || c.idleSecondsFromPrevious > 600 ? (
                          <div style={{
                            margin: '8px 0',
                            padding: '10px 14px',
                            backgroundColor: '#fef3c7',
                            border: '1px dashed #f59e0b',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8rem',
                            color: '#92400e',
                            fontWeight: 700
                          }}>
                            <Coffee size={16} />
                            <span>☕ Vardiya / Duruş Molası: {formatDuration(c.idleSecondsFromPrevious)} (Net süreden düşüldü)</span>
                          </div>
                        ) : c.idleSecondsFromPrevious > 0 ? (
                          <div style={{
                            margin: '2px 0 2px 16px',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>↓ Geçiş süresi: {formatDuration(c.idleSecondsFromPrevious)}</span>
                          </div>
                        ) : null}

                        {/* Carton Card */}
                        <div style={{
                          backgroundColor: isBest ? '#fefce8' : 'var(--bg-card)',
                          border: `1px solid ${isBest ? '#fef08a' : 'var(--border-color)'}`,
                          borderRadius: '8px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                {isBest && '🏆 '}Koli #{c.cartonNo}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                {c.sscc}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isBest && (
                                <span style={{ fontSize: '0.72rem', backgroundColor: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  En Hızlı
                                </span>
                              )}
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: `${paceColor}15`,
                                color: paceColor
                              }}>
                                {c.paceCategory}
                              </span>
                            </div>
                          </div>

                          {/* Metrics row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginTop: '2px' }}>
                            <div>
                              <strong>{c.actualQuantity}</strong> Adet Ürün
                            </div>
                            <div>
                              Dolum Süresi: <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{formatDuration(c.fillDurationSeconds)}</strong>
                            </div>
                            {score > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, color: scoreColor, fontSize: '0.8rem' }}>{score.toFixed(1)} Puan</span>
                              </div>
                            )}
                          </div>

                          {/* Footer row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                            <div>
                              Saat: {c.firstScannedAt ? new Date(c.firstScannedAt).toLocaleTimeString('tr-TR') : '-'}
                              {c.lastScannedAt ? ` - ${new Date(c.lastScannedAt).toLocaleTimeString('tr-TR')}` : ''}
                            </div>
                            <div>
                              Okutan: <strong>{c.operatorName || 'Operatör'}</strong>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </TTDrawer>
    </div>
  );
};

