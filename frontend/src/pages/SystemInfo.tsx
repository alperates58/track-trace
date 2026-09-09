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
  const { user, hasPermission } = useAuth();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission('system.view')) {
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

  if (!hasPermission('system.view')) {
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
    <div className="system-info-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <TTPageHeader
        title="Sistem Bilgisi"
        description="Uygulama sürümü, sunucu kaynakları, bellek kullanımı ve veritabanı bağlantı durumları."
      />

      {info && health && (
        <div className="system-info-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>API Durumu</span>
              <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}><Network size={16} /></span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
              {health.status === 'Healthy' ? 'Online' : health.status}
            </div>
          </div>

          <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Veritabanı</span>
              <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}><Database size={16} /></span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
              {info.dbConnectivity === 'Sağlıklı' ? 'Bağlı' : info.dbConnectivity}
            </div>
          </div>

          <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Sipariş</span>
              <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary)' }}><PackageSearch size={16} /></span>
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
              {info.totalOrders.toLocaleString()}
            </div>
          </div>

          <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Barkod</span>
              <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(234, 179, 8, 0.08)', color: '#d97706' }}><Boxes size={16} /></span>
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
              {info.totalCodes.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="system-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        
        {/* Application details */}
        <TTCard padding="md" style={{ border: '1px solid var(--border-subtle, var(--border-color))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            <LayoutTemplate size={16} style={{ color: 'var(--primary)' }} />
            <span>Uygulama Sürüm Bilgisi</span>
          </div>
          {info ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Versiyon (Version)</span>
                <span className="tabular-nums font-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{info.appVersion}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Derleme Tarihi (Build Date)</span>
                <span className="tabular-nums font-mono" style={{ fontWeight: 500 }}>{info.buildDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Git Commit SHA</span>
                <code className="font-mono" style={{ fontSize: '0.78rem', backgroundColor: 'var(--bg-main)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle, var(--border-color))' }}>{info.gitCommitSHA}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>API Base URL</span>
                <code className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary, var(--text-muted))' }}>{info.frontendApiUrl}</code>
              </div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Veri bulunamadı.</span>
          )}
        </TTCard>

        {/* Server & DB connectivity */}
        <TTCard padding="md" style={{ border: '1px solid var(--border-subtle, var(--border-color))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            <Settings size={16} style={{ color: 'var(--primary)' }} />
            <span>Servis Sağlığı & Kapasite</span>
          </div>
          {health && info ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>API Servisi</span>
                <TTBadge variant={health.status === 'Healthy' ? 'success' : 'danger'} size="sm">
                  {health.status === 'Healthy' ? 'Aktif / Çalışıyor' : health.status}
                </TTBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Veritabanı (PostgreSQL 16)</span>
                <TTBadge variant={info.dbConnectivity === 'Sağlıklı' ? 'success' : 'danger'} size="sm">
                  {info.dbConnectivity === 'Sağlıklı' ? 'Bağlantı Var' : info.dbConnectivity}
                </TTBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Sunucu Bellek Tüketimi</span>
                <span className="tabular-nums font-mono" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} style={{ color: 'var(--text-secondary, var(--text-muted))' }} />
                  {health.memoryUsageMb} MB
                </span>
              </div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Veri bulunamadı.</span>
          )}
        </TTCard>

        {/* Print / Label Engine */}
        <TTCard padding="md" style={{ border: '1px solid var(--border-subtle, var(--border-color))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            <Printer size={16} style={{ color: 'var(--primary)' }} />
            <span>Baskı ve Etiket Motoru</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>PDF Render Motoru</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#10b981' }}>
                <CheckCircle2 size={15} /> Hazır
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>ZPL/EPL Desteği</span>
              <TTBadge variant="success" size="sm">Aktif</TTBadge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Varsayılan Çıktı</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>100x100mm Lojistik</span>
            </div>
          </div>
        </TTCard>

        {/* Security / Cache */}
        <TTCard padding="md" style={{ border: '1px solid var(--border-subtle, var(--border-color))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            <Shield size={16} style={{ color: 'var(--primary)' }} />
            <span>Güvenlik & Oturum</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Aktif Kullanıcı Yetkisi</span>
              <TTBadge variant="info" size="sm">{user?.role || 'Bilinmiyor'}</TTBadge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Oturum Token Durumu</span>
              <TTBadge variant="success" size="sm">Geçerli</TTBadge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>PWA Service Worker</span>
              <span style={{ color: 'var(--text-secondary, var(--text-muted))' }}>Bağımsız (Bypass)</span>
            </div>
          </div>
        </TTCard>

      </div>
    </div>
  );
};
