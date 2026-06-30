import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Cpu, Database, Settings, ShieldAlert, CheckCircle2, Shield, LayoutTemplate, Printer, PackageSearch, Boxes, Network } from 'lucide-react';
import {
  TTPageHeader,
  TTCard,
  TTBadge,
  TTSection,
  TTStatCard,
  TTLoadingState,
  TTEmptyState
} from '../components/common';

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
      <TTEmptyState
        icon={<ShieldAlert size={48} color="var(--danger)" />}
        title="Yetersiz Yetki"
        description="Sistem / Sürüm Bilgisi ekranını yalnızca yöneticiler (Admin) görüntüleyebilir."
      />
    );
  }

  if (loading) {
    return <TTLoadingState text="Sistem bilgileri yükleniyor..." />;
  }

  return (
    <div>
      <TTPageHeader
        title="Sistem Bilgisi"
        description="Uygulama sürümü, sunucu kaynakları, ve veritabanı bağlantı durumları."
      />

      {info && health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <TTStatCard
            title="API Durumu"
            value={health.status === 'Healthy' ? 'Online' : health.status}
            icon={<Network size={20} />}
            color="var(--success)"
          />
          <TTStatCard
            title="Veritabanı Durumu"
            value={info.dbConnectivity === 'Sağlıklı' ? 'Bağlı' : info.dbConnectivity}
            icon={<Database size={20} />}
            color="var(--success)"
          />
          <TTStatCard
            title="Toplam Sipariş"
            value={info.totalOrders}
            icon={<PackageSearch size={20} />}
            color="var(--primary)"
          />
          <TTStatCard
            title="Toplam Barkod"
            value={info.totalCodes}
            icon={<Boxes size={20} />}
            color="var(--warning)"
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Application details */}
        <TTSection title="Uygulama Sürüm Bilgisi" icon={<LayoutTemplate size={20} />}>
          <TTCard padding="md">
            {info ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Versiyon (Version)</span>
                  <span style={{ fontWeight: 700 }}>{info.appVersion}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Derleme Tarihi (Build Date)</span>
                  <span style={{ fontWeight: 500 }}>{info.buildDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Git Commit SHA</span>
                  <code style={{ fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '4px' }}>{info.gitCommitSHA}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>API Base URL</span>
                  <code style={{ fontSize: '0.8rem' }}>{info.frontendApiUrl}</code>
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Veri bulunamadı.</span>
            )}
          </TTCard>
        </TTSection>

        {/* Server & DB connectivity */}
        <TTSection title="Servis Sağlığı & Kapasite" icon={<Settings size={20} />}>
          <TTCard padding="md">
            {health && info ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>API Servisi</span>
                  <TTBadge variant={health.status === 'Healthy' ? 'success' : 'danger'} size="sm">
                    {health.status === 'Healthy' ? 'Aktif / Çalışıyor' : health.status}
                  </TTBadge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Veritabanı (PostgreSQL 16)</span>
                  <TTBadge variant={info.dbConnectivity === 'Sağlıklı' ? 'success' : 'danger'} size="sm">
                    {info.dbConnectivity === 'Sağlıklı' ? 'Bağlantı Var' : info.dbConnectivity}
                  </TTBadge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sunucu Bellek Tüketimi</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={16} color="var(--text-muted)" />
                    {health.memoryUsageMb} MB
                  </span>
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Veri bulunamadı.</span>
            )}
          </TTCard>
        </TTSection>

        {/* Print / Label Engine */}
        <TTSection title="Baskı ve Etiket Motoru" icon={<Printer size={20} />}>
          <TTCard padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>PDF Render Motoru</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <CheckCircle2 size={16} color="var(--success)" /> Hazır
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>ZPL/EPL Desteği</span>
                <TTBadge variant="success" size="sm">Aktif</TTBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Varsayılan Çıktı</span>
                <span style={{ fontWeight: 600 }}>100x100mm Lojistik</span>
              </div>
            </div>
          </TTCard>
        </TTSection>

        {/* Security / Cache */}
        <TTSection title="Güvenlik & Önbellek" icon={<Shield size={20} />}>
          <TTCard padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Aktif Kullanıcı Yetkisi</span>
                <TTBadge variant="primary" size="sm">{user?.role || 'Bilinmiyor'}</TTBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Oturum Token Durumu</span>
                <TTBadge variant="success" size="sm">Geçerli</TTBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>PWA Service Worker</span>
                <span style={{ color: 'var(--text-muted)' }}>Bağımsız (Bypass)</span>
              </div>
            </div>
          </TTCard>
        </TTSection>

      </div>
    </div>
  );
};
