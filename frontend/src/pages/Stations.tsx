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
  const { user } = useAuth();
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

  const isAdmin = user?.role === 'Admin';

  return (
    <div className="page-animate">
      <TTPageHeader 
        title="İstasyon Yönetimi" 
        icon={<Server size={24} />}
        action={
          isAdmin && (
            <TTButton onClick={() => { resetForm(); setShowCreateDrawer(true); }}>
              <Plus size={18} />
              Yeni İstasyon
            </TTButton>
          )
        }
      />

      <TTCard padding="none">
        {loading ? (
          <TTLoadingState text="İstasyonlar yükleniyor..." />
        ) : error && stations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            {error}
          </div>
        ) : stations.length === 0 ? (
          <TTEmptyState 
            icon={<Server size={48} />}
            title="İstasyon Bulunamadı"
            description="Sistemde henüz tanımlı bir istasyon bulunmuyor."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <TTTable 
              headers={[
                'İstasyon Adı',
                'Durum',
                'Kayıt Tarihi',
                ...(isAdmin ? ['İşlemler'] : [])
              ]}
            >
              {stations.map(station => (
                <tr key={station.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '8px', 
                        backgroundColor: 'var(--surface-hover)', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' 
                      }}>
                        <Server size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{station.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {station.id.substring(0, 8)}...</div>
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
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(station.createdAt).toLocaleString('tr-TR')}
                  </td>
                  {isAdmin && (
                    <td>
                      <TTButton variant="ghost" size="sm" onClick={() => handleEditOpen(station)}>
                        <Edit size={16} />
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
        <form onSubmit={handleCreateStation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ padding: '12px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '6px', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">İstasyon Adı</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Örn: Paketleme Masa 1"
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
                style={{ width: '16px', height: '16px' }}
              />
              İstasyon Aktif
            </label>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
              Pasif istasyonlar ürün okutma ekranında seçilemez.
            </span>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <TTButton type="button" variant="ghost" style={{ flex: 1 }} onClick={() => setShowCreateDrawer(false)}>İptal</TTButton>
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
        <form onSubmit={handleUpdateStation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ padding: '12px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '6px', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">İstasyon Adı</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Örn: Paketleme Masa 1"
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
                style={{ width: '16px', height: '16px' }}
              />
              İstasyon Aktif
            </label>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px', marginLeft: '24px' }}>
              Pasif istasyonlar ürün okutma ekranında seçilemez.
            </span>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <TTButton type="button" variant="ghost" style={{ flex: 1 }} onClick={() => setShowEditDrawer(false)}>İptal</TTButton>
            <TTButton type="submit" variant="primary" style={{ flex: 1 }}>Güncelle</TTButton>
          </div>
        </form>
      </TTDrawer>
    </div>
  );
};
