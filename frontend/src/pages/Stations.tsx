import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Server, CheckCircle, XCircle } from 'lucide-react';
import {
  TTPageHeader,
  TTButton,
  TTCard,
  TTBadge,
  TTTable,
  TTDrawer,
  TTLoadingState,
  TTEmptyState
} from '../components/common';

interface Station {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export const Stations: React.FC = () => {
  const { hasPermission } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer states
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchStations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/stations?includeInactive=true');
      setStations(data);
    } catch (err: any) {
      setError(err.message || 'İstasyonlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const resetForm = () => {
    setName('');
    setIsActive(true);
    setError(null);
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('İstasyon adı boş olamaz.');
      return;
    }
    try {
      await api.post('/api/stations', { name, isActive });
      setShowCreateDrawer(false);
      resetForm();
      fetchStations();
    } catch (err: any) {
      setError(err.message || 'İstasyon oluşturulurken bir hata oluştu.');
    }
  };

  const handleEditOpen = (s: Station) => {
    setSelectedStation(s);
    setName(s.name);
    setIsActive(s.isActive);
    setShowEditDrawer(true);
  };

  const handleUpdateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStation) return;
    setError(null);
    if (!name.trim()) {
      setError('İstasyon adı boş olamaz.');
      return;
    }
    
    try {
      await api.put(`/api/stations/${selectedStation.id}`, { name, isActive });
      setShowEditDrawer(false);
      resetForm();
      fetchStations();
    } catch (err: any) {
      setError(err.message || 'İstasyon güncellenirken bir hata oluştu.');
    }
  };

  return (
    <div className="page-animate" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <TTPageHeader 
        title="İstasyon Yönetimi" 
        description="Paketleme ve barkod okuma istasyonlarını, telemetry durumlarını ve hat tanımlarını yönetin."
        actions={
          (hasPermission('stations.create') || hasPermission('system.manage')) ? (
            <TTButton variant="primary" icon={<Plus size={16} />} onClick={() => { resetForm(); setShowCreateDrawer(true); }}>
              Yeni İstasyon
            </TTButton>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam İstasyon</span>
            <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary)' }}><Server size={16} /></span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            {stations.length}
          </div>
        </div>

        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aktif Hatlar</span>
            <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}><CheckCircle size={16} /></span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            {stations.filter(s => s.isActive).length}
          </div>
        </div>

        <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pasif Hatlar</span>
            <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}><XCircle size={16} /></span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
            {stations.filter(s => !s.isActive).length}
          </div>
        </div>
      </div>

      <TTCard padding="none" style={{ overflow: 'hidden', border: '1px solid var(--border-subtle, var(--border-color))' }}>
        {loading ? (
          <div style={{ padding: '32px' }}>
            <TTLoadingState text="İstasyonlar yükleniyor..." />
          </div>
        ) : error && stations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-text, #ef4444)' }}>
            {error}
          </div>
        ) : stations.length === 0 ? (
          <div style={{ padding: '32px' }}>
            <TTEmptyState 
              icon={<Server size={40} color="var(--text-muted)" />}
              title="İstasyon Bulunamadı"
              description="Sistemde henüz tanımlı bir istasyon bulunmuyor."
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <TTTable 
              headers={[
                'İstasyon Adı',
                'Durum',
                'Kayıt Tarihi',
                ...( (hasPermission('stations.edit') || hasPermission('system.manage')) ? ['İşlemler'] : [])
              ]}
            >
              {stations.map(station => (
                <tr key={station.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '32px', height: '32px', borderRadius: 'var(--radius-sm, 6px)', 
                        backgroundColor: 'var(--bg-main)', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                        border: '1px solid var(--border-subtle, var(--border-color))'
                      }}>
                        <Server size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, var(--text-main))', fontSize: '0.9rem' }}>{station.name}</div>
                        <div className="tabular-nums font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }}>ID: {station.id.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {station.isActive ? (
                      <TTBadge variant="success" size="sm" icon={<CheckCircle size={12} />}>Aktif</TTBadge>
                    ) : (
                      <TTBadge variant="neutral" size="sm" icon={<XCircle size={12} />}>Pasif</TTBadge>
                    )}
                  </td>
                  <td className="tabular-nums font-mono" style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.82rem' }}>
                    {new Date(station.createdAt).toLocaleString('tr-TR')}
                  </td>
                  { (hasPermission('stations.edit') || hasPermission('system.manage')) && (
                    <td>
                      <TTButton variant="secondary" size="sm" onClick={() => handleEditOpen(station)} icon={<Edit size={14} />}>
                        Düzenle
                      </TTButton>
                    </td>
                  )}
                </tr>
              ))}
            </TTTable>
          </div>
        )}
      </TTCard>

      {/* Create Station Drawer */}
      <TTDrawer
        isOpen={showCreateDrawer}
        onClose={() => { setShowCreateDrawer(false); resetForm(); }}
        title="Yeni İstasyon Oluştur"
      >
        <form onSubmit={handleCreateStation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg, #fee2e2)', color: 'var(--danger-text, #dc2626)', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginBottom: '6px', display: 'block' }}>İstasyon Adı *</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Örn: Paketleme Masa 1"
              required 
              style={{ height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              İstasyon Aktif
            </label>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, var(--text-muted))', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
              Pasif istasyonlar ürün okutma ekranında seçilemez.
            </span>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle, var(--border-color))' }}>
            <TTButton type="button" variant="secondary" style={{ flex: 1 }} onClick={() => setShowCreateDrawer(false)}>İptal</TTButton>
            <TTButton type="submit" variant="primary" style={{ flex: 1 }}>Kaydet</TTButton>
          </div>
        </form>
      </TTDrawer>

      {/* Edit Station Drawer */}
      <TTDrawer
        isOpen={showEditDrawer}
        onClose={() => { setShowEditDrawer(false); resetForm(); }}
        title="İstasyonu Düzenle"
      >
        <form onSubmit={handleUpdateStation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--danger-bg, #fee2e2)', color: 'var(--danger-text, #dc2626)', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginBottom: '6px', display: 'block' }}>İstasyon Adı *</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Örn: Paketleme Masa 1"
              required 
              style={{ height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              İstasyon Aktif
            </label>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, var(--text-muted))', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
              Pasif istasyonlar ürün okutma ekranında seçilemez.
            </span>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle, var(--border-color))' }}>
            <TTButton type="button" variant="secondary" style={{ flex: 1 }} onClick={() => setShowEditDrawer(false)}>İptal</TTButton>
            <TTButton type="submit" variant="primary" style={{ flex: 1 }}>Güncelle</TTButton>
          </div>
        </form>
      </TTDrawer>
    </div>
  );
};
