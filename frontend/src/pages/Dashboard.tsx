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
    // Auto-refresh live feed every 1 second
    const interval = setInterval(() => {
      api.get('/api/dashboard/live-feed')
        .then(res => {
          if (res) setLiveFeed(res);
          setLastUpdated(new Date());
        })
        .catch(() => {});
    }, 1000);
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
              <Radio size={14} className="spin-anim" /> CANLI AKIŞ (1s)
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
        <div className="tv-modal-overlay">
          {/* TV HEADER */}
          <div className="tv-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
                padding: '14px', 
                borderRadius: '14px',
                boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
                flexShrink: 0
              }}>
                <Tv size={34} color="#ffffff" />
              </div>
              <div>
                <h1 className="tv-title-h1">
                  TRACKTRACE DEPO CANLI KONTROL EKRANI
                </h1>
                <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                  <Server size={16} color="#38bdf8" /> Fabrika & Paketleme Bandı Anlık İzleme Monitörü
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'right', backgroundColor: '#090d16', padding: '10px 18px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', color: '#38bdf8', letterSpacing: '1px' }}>
                  {currentTime.toLocaleTimeString('tr-TR')}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 10px #4ade80', display: 'inline-block' }} />
                  CANLI AKIŞ <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Veri: {lastUpdated.toLocaleTimeString('tr-TR')})</span>
                </div>
              </div>

              <button 
                onClick={() => setIsTvMode(false)}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
              >
                <Minimize2 size={18} color="#94a3b8" /> Çıkış Yap (ESC)
              </button>
            </div>
          </div>

          {/* TV TOP GIANT STATS */}
          <div className="tv-stats-grid">
            {/* CARD 1: OKUTULAN ÜRÜN */}
            <div style={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '16px', 
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bugün Okutulan Ürün
                </span>
                <CheckCircle size={20} color="#10b981" />
              </div>
              <div className="tv-stat-number" style={{ color: '#10b981' }}>
                {liveFeed?.todayTotalItems || data?.scannedTodayCount || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                Veri Matrix Başarılı Okutma
              </div>
            </div>

            {/* CARD 2: KAPANAN KOLİ */}
            <div style={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '16px', 
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bugün Kapanan Koli
                </span>
                <Inbox size={20} color="#38bdf8" />
              </div>
              <div className="tv-stat-number" style={{ color: '#38bdf8' }}>
                {liveFeed?.todayTotalCartons || data?.cartonsCreatedTodayCount || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                Tamamlanan Sevkiyat Kolileri
              </div>
            </div>

            {/* CARD 3: AKTİF İSTASYON */}
            <div style={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '16px', 
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aktif İstasyon Sayısı
                </span>
                <Server size={20} color="#60a5fa" />
              </div>
              <div className="tv-stat-number" style={{ color: '#60a5fa' }}>
                {liveFeed?.activeStationCount || 0} <span style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8' }}>İstasyon</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                Çalışan Paketleme Hatları
              </div>
            </div>

            {/* CARD 4: ANLIK OKUTMA HIZI */}
            <div style={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '16px', 
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Anlık Okutma Hızı
                </span>
                <Zap size={20} color="#f43f5e" />
              </div>
              <div className="tv-stat-number" style={{ color: '#f43f5e' }}>
                {liveFeed?.currentPaceSecondsPerItem ? `${liveFeed.currentPaceSecondsPerItem.toFixed(1)}` : '0'} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>sn / ürün</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                Son 2 Okutma Arası Süre
              </div>
            </div>

            {/* CARD 5: ORTALAMA HIZ (SON 30 DK) */}
            <div style={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #1e293b', 
              borderRadius: '16px', 
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ort. Hız (Son 30 Dk)
                </span>
                <Activity size={20} color="#c084fc" />
              </div>
              <div className="tv-stat-number" style={{ color: '#c084fc' }}>
                {liveFeed?.avgPace30MinSecondsPerItem ? `${liveFeed.avgPace30MinSecondsPerItem.toFixed(1)}` : '0'} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>sn / ürün</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                30 Dk Genel Ortalama
              </div>
            </div>
          </div>

          {/* TV STATIONS GRID */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={20} color="#38bdf8" /> İSTASYON CANLI PERFORMANS MONİTÖRÜ
            </h2>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
              Toplam {liveFeed?.activeStations?.length || 0} İstasyon Tanımlı
            </span>
          </div>

          <div className="tv-stations-grid">
            {(liveFeed?.activeStations || []).map(st => {
              const isActive = st.status === 'Active';
              const progressPct = Math.min(100, Math.round((st.cartonCurrentQty / Math.max(1, st.cartonTargetQty)) * 100));

              return (
                <div 
                  key={st.stationId} 
                  style={{ 
                    backgroundColor: '#0f172a', 
                    border: isActive ? '2px solid #10b981' : '1px solid #1e293b', 
                    boxShadow: isActive ? '0 0 24px rgba(16, 185, 129, 0.25)' : '0 4px 16px rgba(0,0,0,0.3)',
                    borderRadius: '20px', 
                    padding: '26px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* STATION CARD HEADER */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ffffff' }}>
                          {st.stationName}
                        </h2>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                          KOD: {st.stationCode}
                        </span>
                      </div>
                      <span style={{ 
                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(51, 65, 85, 0.5)', 
                        color: isActive ? '#4ade80' : '#94a3b8', 
                        border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.4)' : '#334155'}`,
                        padding: '6px 16px', 
                        borderRadius: '30px', 
                        fontWeight: 800, 
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isActive ? '#4ade80' : '#64748b', boxShadow: isActive ? '0 0 8px #4ade80' : 'none' }} />
                        {isActive ? 'PAKETLENİYOR' : 'BEKLEMEDE'}
                      </span>
                    </div>

                    {/* ACTIVE STATION CONTENT */}
                    {isActive ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ backgroundColor: '#090d16', padding: '14px 18px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '1.05rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Aktif Sipariş:</span>
                            <strong style={{ color: '#38bdf8', fontSize: '1.2rem', fontFamily: 'monospace' }}>{st.currentOrderNo}</strong>
                          </div>
                          <div style={{ fontSize: '1.05rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Stok Kodu:</span>
                            <strong style={{ color: '#ffffff', fontSize: '1.1rem' }}>{st.currentStockCode}</strong>
                          </div>
                          <div style={{ fontSize: '1.05rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Operatör:</span>
                            <span style={{ color: '#cbd5e1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={16} color="#38bdf8" /> {st.operatorName || 'Operatör'}
                            </span>
                          </div>
                        </div>

                        {/* LIVE CARTON THICK PROGRESS BAR */}
                        <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '14px', border: '1px solid #1e293b', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', marginBottom: '10px', alignItems: 'center' }}>
                            <span style={{ color: '#cbd5e1', fontWeight: 700 }}>
                              Aktif Koli: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{st.currentCartonNo}</span>
                            </span>
                            <strong style={{ color: progressPct === 100 ? '#4ade80' : '#38bdf8', fontSize: '1.2rem', fontWeight: 900 }}>
                              {st.cartonCurrentQty} / {st.cartonTargetQty} Ürün ({progressPct}%)
                            </strong>
                          </div>

                          <div style={{ height: '16px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden', padding: '2px' }}>
                            <div style={{ 
                              height: '100%', 
                              width: `${progressPct}%`, 
                              background: progressPct === 100 ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)', 
                              borderRadius: '6px', 
                              transition: 'width 0.4s ease',
                              boxShadow: progressPct === 100 ? '0 0 12px rgba(16, 185, 129, 0.5)' : '0 0 12px rgba(56, 189, 248, 0.5)'
                            }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                            <span>SSCC: {st.currentCartonSscc || '-'}</span>
                            <span style={{ color: '#4ade80', fontWeight: 600 }}>● Son Okutma: {getRelativeSeconds(st.lastScannedAt)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* IDLE / WAITING STATION SLEEK EMPTY STATE */
                      <div style={{ 
                        backgroundColor: '#090d16', 
                        padding: '20px', 
                        borderRadius: '14px', 
                        border: '1px dashed #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        marginTop: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                          <span style={{ color: '#64748b' }}>Operatör:</span>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{st.operatorName || 'Atanmadı'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                          <span style={{ color: '#64748b' }}>Son İşlem:</span>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{getRelativeSeconds(st.lastScannedAt) || 'Henüz İşlem Yok'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                          <span style={{ color: '#64748b' }}>Son 1 Saatlik Okutma:</span>
                          <span style={{ color: '#38bdf8', fontWeight: 700 }}>{st.itemsScannedLastHour || 0} Ürün</span>
                        </div>
                        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px', marginTop: '4px', textAlign: 'center', color: '#475569', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          ⓘ Bu hat şu an bekleme modunda. Paketleme başladığında otomatik aktifleşecektir.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
