import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Cpu, Database, Settings, ShieldAlert } from 'lucide-react';

interface SystemInfo {
  appVersion: string;
  buildDate: string;
  gitCommitSHA: string;
  apiStatus: string;
  dbConnectivity: string;
  frontendApiUrl: string;
  totalOrders: number;
  totalCodes: number;
}

interface SystemHealth {
  status: string;
  database: string;
  memoryUsageMb: number;
  timestamp: string;
}

export const SystemInfo: React.FC = () => {
  const { user } = useAuth();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'Admin') {
      setLoading(false);
      return;
    }

    Promise.all([
      api.get('/api/system/info'),
      api.get('/api/system/health')
    ])
      .then(([infoData, healthData]) => {
        setInfo(infoData);
        setHealth(healthData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (user?.role !== 'Admin') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--danger-text)' }}>
        <ShieldAlert size={48} style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Yetersiz Yetki</h3>
        <p style={{ color: 'var(--text-muted)' }}>Sistem / Sürüm Bilgisi ekranını yalnızca yöneticiler (Admin) görüntüleyebilir.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Yükleniyor...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Sistem Bilgisi</h2>
        <p style={{ color: 'var(--text-muted)' }}>Uygulama sürümü, sunucu kaynakları, ve veritabanı bağlantı durumları.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Application details */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--primary)" />
            Uygulama Sürüm Bilgisi
          </h3>
          {info && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Versiyon (Version)</span>
                <span style={{ fontWeight: 700 }}>{info.appVersion}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Derleme Tarihi (Build Date)</span>
                <span style={{ fontWeight: 500 }}>{info.buildDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Git Commit SHA</span>
                <code style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{info.gitCommitSHA}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>API Base URL</span>
                <code style={{ fontSize: '0.8rem' }}>{info.frontendApiUrl}</code>
              </div>
            </div>
          )}
        </div>

        {/* Server & DB connectivity */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="var(--primary)" />
            Servis Sağlığı & Kapasite
          </h3>
          {health && info && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>API Servisi</span>
                <span className="badge badge-completed" style={{ fontWeight: 700 }}>{health.status === 'Healthy' ? 'Aktif / Çalışıyor' : health.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Veritabanı (PostgreSQL 16)</span>
                <span className="badge badge-completed" style={{ fontWeight: 700 }}>{info.dbConnectivity === 'Sağlıklı' ? 'Bağlantı Var' : info.dbConnectivity}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Toplam Sipariş Sayısı</span>
                <span style={{ fontWeight: 600 }}>{info.totalOrders}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Toplam Kayıtlı Barkod</span>
                <span style={{ fontWeight: 600 }}>{info.totalCodes}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sunucu Bellek Tüketimi</span>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Cpu size={16} color="var(--text-muted)" />
                  {health.memoryUsageMb} MB
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
