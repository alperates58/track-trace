import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Package, Inbox, Layers, CheckCircle, FileText, Activity } from 'lucide-react';

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

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/summary')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center', fontSize: '1.25rem' }}>Yükleniyor...</div>;
  }

  if (!data) {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--danger-text)' }}>Özet veriler yüklenemedi.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Hoş Geldiniz</h2>
        <p style={{ color: 'var(--text-muted)' }}>Sistem genelindeki güncel üretim ve paketleme durumları.</p>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Aktif Siparişler</span>
            <span className="stat-value">{data.activeOrdersCount}</span>
          </div>
          <div className="stat-icon stat-blue">
            <Package size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Açık Koliler</span>
            <span className="stat-value">{data.openCartonsCount}</span>
          </div>
          <div className="stat-icon stat-yellow">
            <Inbox size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Açık Paletler</span>
            <span className="stat-value">{data.openPalletsCount}</span>
          </div>
          <div className="stat-icon stat-purple">
            <Layers size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-title">Bugün Okutulan Ürün</span>
            <span className="stat-value">{data.scannedTodayCount}</span>
          </div>
          <div className="stat-icon stat-green">
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        {/* Today's Production */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--primary)" />
            Bugünkü Paketleme İstatistikleri
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Bugün Oluşturulan Koliler</span>
              <span style={{ fontWeight: 700 }}>{data.cartonsCreatedTodayCount} Koli</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Bugün Oluşturulan Paletler</span>
              <span style={{ fontWeight: 700 }}>{data.palletsCreatedTodayCount} Palet</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ortalama Koli/Sipariş Oranı</span>
              <span style={{ fontWeight: 700 }}>
                {data.activeOrdersCount > 0 ? (data.cartonsCreatedTodayCount / data.activeOrdersCount).toFixed(1) : 0} koli/sipariş
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity Logs */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--primary)" />
            Son İşlemler (Audit Feed)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
            {data.recentActivities.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>Henüz kayıtlı bir işlem yok.</p>
            ) : (
              data.recentActivities.map((act, idx) => (
                <div key={idx} style={{
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  borderLeft: '3px solid var(--primary)',
                  fontSize: '0.85rem',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                }}>
                  <p>{act.message}</p>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(act.createdAt).toLocaleTimeString('tr-TR')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
