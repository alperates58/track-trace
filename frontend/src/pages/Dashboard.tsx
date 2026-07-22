import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { 
  Package, 
  Inbox, 
  Layers, 
  CheckCircle, 
  Activity, 
  Tv, 
  Zap, 
  User, 
  Minimize2, 
  Radio,
  Server
} from 'lucide-react';
import { TTPageHeader, TTButton } from '../components/common';

interface RecentActivity {
  message: string;
  createdAt: string;
  user: string;
}

interface DashboardSummary {
  activeOrdersCount: number;
  openCartonsCount: number;
  openPalletsCount: number;
  scannedTodayCount: number;
  cartonsCreatedTodayCount: number;
  palletsCreatedTodayCount: number;
  recentActivities: RecentActivity[];
}

interface LiveStation {
  stationId: string;
  stationName: string;
  stationCode: string;
  status: string; // Active, Idle
  operatorName?: string;
  currentOrderNo?: string;
  currentStockCode?: string;
  currentCartonNo?: string;
  currentCartonSscc?: string;
  cartonCurrentQty: number;
  cartonTargetQty: number;
  lastScannedAt?: string;
  itemsScannedLastHour: number;
}

interface LiveScanItem {
  id: string;
  rawCode: string;
  orderNo: string;
  stockCode: string;
  cartonNo: string;
  stationName: string;
  operatorName: string;
  scannedAt: string;
}

interface LiveFeedData {
  activeStationCount: number;
  todayTotalItems: number;
  todayTotalCartons: number;
  currentPaceItemsPerMin: number;
  currentPaceSecondsPerItem: number;
  avgPace30MinSecondsPerItem: number;
  activeStations: LiveStation[];
  recentScansFeed: LiveScanItem[];
}

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [liveFeed, setLiveFeed] = useState<LiveFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTvMode, setIsTvMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Ticking digital clock for live display
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Listen for ESC key to exit TV mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTvMode) {
        setIsTvMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode]);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, liveRes] = await Promise.all([
        api.get('/api/dashboard/summary'),
        api.get('/api/dashboard/live-feed').catch(() => null)
      ]);
      setData(summaryRes);
      if (liveRes) setLiveFeed(liveRes);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh live feed every 3 seconds
    const interval = setInterval(() => {
      api.get('/api/dashboard/live-feed')
        .then(res => {
          if (res) setLiveFeed(res);
          setLastUpdated(new Date());
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Format relative seconds
  const getRelativeSeconds = (dateStr?: string) => {
    if (!dateStr) return null;
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 5) return 'Az önce';
    if (diff < 60) return `${diff} sn önce`;
    const mins = Math.floor(diff / 60);
    return `${mins} dk önce`;
  };

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Dashboard verileri yükleniyor...</div>;
  }

  return (
    <div style={{ padding: '4px' }}>
      {/* HEADER WITH LIVE TV MODE BUTTON */}
      <TTPageHeader
        title="Dashboard & Canlı İzleme Ekranı"
        description="Depo paketleme bandı, istasyon durumları ve canlı QR okutma akışı."
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
              <Radio size={14} className="spin-anim" /> CANLI AKIŞ (3s)
            </div>
            <TTButton 
              variant="primary" 
              onClick={() => setIsTvMode(true)}
              icon={<Tv size={16} />}
              style={{ backgroundColor: '#0f172a', borderColor: '#0f172a' }}
            >
              📺 Canlı TV Ekranı Modu
            </TTButton>
          </div>
        }
      />

      {/* TOP KPI STATS GRID */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Aktif Siparişler</span>
            <span className="stat-value">{data?.activeOrdersCount || 0}</span>
          </div>
          <div className="stat-icon stat-blue">
            <Package size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Açık Koliler</span>
            <span className="stat-value">{data?.openCartonsCount || 0}</span>
          </div>
          <div className="stat-icon stat-yellow">
            <Inbox size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Açık Paletler</span>
            <span className="stat-value">{data?.openPalletsCount || 0}</span>
          </div>
          <div className="stat-icon stat-purple">
            <Layers size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Bugün Okutulan Ürün</span>
            <span className="stat-value">{data?.scannedTodayCount || 0}</span>
          </div>
          <div className="stat-icon stat-green">
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      {/* CANLI İSTASYON İZLEME BANDI (LIVE STATIONS MONITOR) */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} color="var(--primary)" /> Canlı İstasyon Durumları
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Son Güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}
          </span>
        </div>

        {!liveFeed?.activeStations || liveFeed.activeStations.length === 0 ? (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Sistemde kayıtlı aktif istasyon bulunamadı.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {liveFeed.activeStations.map(st => {
              const isActive = st.status === 'Active';
              const progressPct = Math.min(100, Math.round((st.cartonCurrentQty / Math.max(1, st.cartonTargetQty)) * 100));

              return (
                <div 
                  key={st.stationId} 
                  className="card"
                  style={{ 
                    borderLeft: `4px solid ${isActive ? '#16a34a' : '#cbd5e1'}`, 
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {st.stationName}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Kod: {st.stationCode}
                      </span>
                    </div>

                    <span style={{ 
                      fontSize: '0.72rem', 
                      fontWeight: 700, 
                      padding: '3px 8px', 
                      borderRadius: '12px',
                      backgroundColor: isActive ? '#dcfce7' : '#f1f5f9',
                      color: isActive ? '#15803d' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isActive ? <><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} /> PAKETLENİYOR</> : 'BEKLEMEDE'}
                    </span>
                  </div>

                  {isActive ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Aktif Sipariş:</span>
                        <strong style={{ color: 'var(--primary)' }}>{st.currentOrderNo}</strong>
                      </div>
                      
                      <div style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Stok Kodu:</span>
                        <strong>{st.currentStockCode}</strong>
                      </div>

                      <div style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Operatör:</span>
                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} /> {st.operatorName}
                        </span>
                      </div>

                      {/* Live Carton Progress */}
                      <div style={{ marginTop: '6px', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span>Aktif Koli ({st.currentCartonNo})</span>
                          <strong style={{ color: progressPct === 100 ? '#16a34a' : 'var(--primary)' }}>
                            {st.cartonCurrentQty} / {st.cartonTargetQty} Ürün ({progressPct}%)
                          </strong>
                        </div>
                        <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${progressPct}%`, 
                            backgroundColor: progressPct === 100 ? '#16a34a' : 'var(--primary)',
                            borderRadius: '4px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                        Son Okutma: {getRelativeSeconds(st.lastScannedAt)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Şu an bu istasyonda aktif paketleme yapılmıyor.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DASHBOARD BOTTOM SPLIT GRID */}
      <div className="dashboard-split-grid">
        {/* CANLI QR OKUTMA AKIŞI (LIVE STREAM FEED) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="#16a34a" /> Canlı QR Okutma Akışı
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
              Anlık Yayın
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            {!liveFeed?.recentScansFeed || liveFeed.recentScansFeed.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>
                Henüz canlı okutma verisi bulunmuyor.
              </p>
            ) : (
              liveFeed.recentScansFeed.map((item) => (
                <div key={item.id} style={{
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderLeft: '4px solid #16a34a',
                  borderRadius: '0 8px 8px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{item.orderNo}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>| Koli: {item.cartonNo}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Stok: {item.stockCode} — {item.stationName} ({item.operatorName})
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.8rem', display: 'block' }}>
                      ✓ OKUNDU
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(item.scannedAt).toLocaleTimeString('tr-TR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT AUDIT ACTIVITIES */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--primary)" />
            Son İşlemler (Audit Feed)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
            {!data?.recentActivities || data.recentActivities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '30px' }}>Henüz kayıtlı bir işlem yok.</p>
            ) : (
              data.recentActivities.map((act, idx) => (
                <div key={idx} style={{
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderLeft: '3px solid var(--primary)',
                  fontSize: '0.85rem',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>{act.message}</p>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>{new Date(act.createdAt).toLocaleTimeString('tr-TR')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FULL-SCREEN CANLI TV / DEPO EKRANI MODAL */}
      {isTvMode && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          zIndex: 9999,
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* TV HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: '#2563eb', padding: '12px', borderRadius: '12px' }}>
                <Tv size={32} color="#ffffff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '1px' }}>TRACKTRACE DEPO CANLI KONTROL EKRANI</h1>
                <span style={{ fontSize: '1rem', color: '#94a3b8' }}>Fabrika & Paketleme Bandı Anlık İzleme Monitörü</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', color: '#38bdf8' }}>
                  {currentTime.toLocaleTimeString('tr-TR')}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>CANLI YAYIN 🟢 (Veri: {lastUpdated.toLocaleTimeString('tr-TR')})</span>
              </div>

              <button 
                onClick={() => setIsTvMode(false)}
                style={{
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Minimize2 size={18} /> Çıkış Yap (ESC)
              </button>
            </div>
          </div>

          {/* TV TOP GIANT STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Bugün Okutulan Ürün</span>
              <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#4ade80', marginTop: '6px' }}>
                {liveFeed?.todayTotalItems || data?.scannedTodayCount || 0}
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Bugün Kapanan Koli</span>
              <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#38bdf8', marginTop: '6px' }}>
                {liveFeed?.todayTotalCartons || data?.cartonsCreatedTodayCount || 0}
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Aktif İstasyon Sayısı</span>
              <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#facc15', marginTop: '6px' }}>
                {liveFeed?.activeStationCount || 0} İstasyon
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Anlık Okutma Hızı</span>
              <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#f43f5e', marginTop: '6px' }}>
                {liveFeed?.currentPaceSecondsPerItem ? `${liveFeed.currentPaceSecondsPerItem.toFixed(1)}` : '0'} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8' }}>sn / ürün</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Ort. Hız (Son 30 Dk)</span>
              <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#a855f7', marginTop: '6px' }}>
                {liveFeed?.avgPace30MinSecondsPerItem ? `${liveFeed.avgPace30MinSecondsPerItem.toFixed(1)}` : '0'} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#94a3b8' }}>sn / ürün</span>
              </div>
            </div>
          </div>

          {/* TV STATIONS GRID */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {(liveFeed?.activeStations || []).map(st => {
              const isActive = st.status === 'Active';
              const progressPct = Math.min(100, Math.round((st.cartonCurrentQty / Math.max(1, st.cartonTargetQty)) * 100));

              return (
                <div key={st.stationId} style={{ backgroundColor: '#1e293b', border: `2px solid ${isActive ? '#22c55e' : '#475569'}`, borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{st.stationName}</h2>
                    <span style={{ backgroundColor: isActive ? '#15803d' : '#334155', color: '#ffffff', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem' }}>
                      {isActive ? '🟢 PAKETLENİYOR' : '⚪ BEKLEMEDE'}
                    </span>
                  </div>

                  {isActive ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '1.1rem' }}>Sipariş: <strong style={{ color: '#38bdf8' }}>{st.currentOrderNo}</strong></div>
                      <div style={{ fontSize: '1.1rem' }}>Stok: <strong>{st.currentStockCode}</strong></div>
                      <div style={{ fontSize: '1rem', color: '#94a3b8' }}>Operatör: {st.operatorName}</div>
                      
                      <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '12px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '8px' }}>
                          <span>Aktif Koli: {st.currentCartonNo}</span>
                          <strong style={{ color: '#4ade80' }}>{st.cartonCurrentQty} / {st.cartonTargetQty} ({progressPct}%)</strong>
                        </div>
                        <div style={{ height: '14px', backgroundColor: '#334155', borderRadius: '7px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: '#22c55e', borderRadius: '7px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: '1.1rem' }}>
                      Bu istasyonda işlem yapılmıyor.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
