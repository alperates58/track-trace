import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  UserPlus, Shield, CheckCircle, XCircle, Edit, Users as UsersIcon, 
  List, LayoutGrid, Search, Eye, EyeOff, Building2, Clock, 
  AlertTriangle, ShieldCheck, UserX, X
} from 'lucide-react';
import {
  TTPageHeader,
  TTButton,
  TTBadge,
  TTTable,
  TTUserAvatar,
  TTDrawer,
  TTModal,
  TTLoadingState,
  TTEmptyState,
  TTFilterBar
} from '../components/common';
import { PermissionMatrix } from './PermissionMatrix';

interface Station {
  id: string;
  name: string;
  isActive?: boolean;
}

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
  defaultStationId?: string | null;
  defaultStationName?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

export const Users: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'matrix'>('list');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Admin' | 'Operator' | 'Viewer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Drawer states
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('Viewer');
  const [isActive, setIsActive] = useState(true);
  const [defaultStationId, setDefaultStationId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Toggle active modal states
  const [toggleModalUser, setToggleModalUser] = useState<User | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Kullanıcılar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const data = await api.get('/api/stations?includeInactive=false');
      setStations(Array.isArray(data) ? data : []);
    } catch {
      setStations([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStations();
  }, []);

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setRole('Viewer');
    setIsActive(true);
    setDefaultStationId(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Girdiğiniz şifreler birbiriyle uyuşmuyor.');
      return;
    }
    try {
      await api.post('/api/users', { 
        name, 
        username, 
        password, 
        role,
        defaultStationId: defaultStationId || null
      });
      setShowCreateDrawer(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı oluşturulurken bir hata oluştu.');
    }
  };

  const handleEditOpen = (u: User) => {
    setSelectedUser(u);
    setName(u.name);
    setUsername(u.username);
    setPassword('');
    setConfirmPassword('');
    setRole(u.role);
    setIsActive(u.isActive);
    setDefaultStationId(u.defaultStationId || null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
    setShowEditDrawer(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError(null);
    if (password && password !== confirmPassword) {
      setError('Girdiğiniz şifreler birbiriyle uyuşmuyor.');
      return;
    }
    try {
      await api.put(`/api/users/${selectedUser.id}`, {
        name,
        username,
        password: password || null,
        role,
        isActive,
        defaultStationId: defaultStationId || null
      });
      setShowEditDrawer(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı güncellenirken bir hata oluştu.');
    }
  };

  const confirmToggleActive = async () => {
    if (!toggleModalUser) return;
    if (currentUser?.id === toggleModalUser.id) {
      alert('Kendi hesabınızı pasifleştiremezsiniz.');
      setToggleModalUser(null);
      return;
    }

    setIsToggling(true);
    try {
      await api.post(`/api/users/${toggleModalUser.id}/toggle`, {});
      setToggleModalUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Kullanıcı durumu güncellenemedi.');
    } finally {
      setIsToggling(false);
    }
  };

  // Filtered list
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(u => {
      const matchesQuery = !q || 
        u.name.toLowerCase().includes(q) || 
        u.username.toLowerCase().includes(q) ||
        (u.defaultStationName && u.defaultStationName.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && u.isActive) || 
        (statusFilter === 'inactive' && !u.isActive);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // KPI calculations
  const stats = useMemo(() => {
    const total = users.length;
    const operators = users.filter(u => u.role === 'Operator' && u.isActive).length;
    const admins = users.filter(u => u.role === 'Admin' && u.isActive).length;
    const inactives = users.filter(u => !u.isActive).length;
    return { total, operators, admins, inactives };
  }, [users]);

  // Date Formatter
  const formatDateTime = (isoDate?: string | null) => {
    if (!isoDate) return 'Henüz giriş yapmadı';
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `Bugün ${timeStr}`;
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Dün ${timeStr}`;
      }
      return `${date.toLocaleDateString('tr-TR')} ${timeStr}`;
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="users-page flex flex-col gap-5">
      <TTPageHeader
        title="Kullanıcı Yönetimi"
        description="Sistem kullanıcılarını ekleyin, istasyonlarını eşleştirin ve rol bazlı erişim yetkilerini yönetin."
        actions={
          (hasPermission('users.create') || hasPermission('users.manage')) ? (
            <TTButton
              variant="primary"
              icon={<UserPlus size={18} />}
              onClick={() => { resetForm(); setShowCreateDrawer(true); }}
            >
              Yeni Kullanıcı Ekle
            </TTButton>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-secondary, var(--text-muted))',
            fontWeight: activeTab === 'list' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            transition: 'all 0.15s ease'
          }}
        >
          <List size={16} /> Kullanıcı Listesi (<span className="tabular-nums font-mono">{users.length}</span>)
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'matrix' ? 'var(--primary)' : 'var(--text-secondary, var(--text-muted))',
            fontWeight: activeTab === 'matrix' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            transition: 'all 0.15s ease'
          }}
        >
          <LayoutGrid size={16} /> Rol ve Yetki Matrisi
        </button>
      </div>

      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KPI Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Kullanıcı</span>
                <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary)' }}><UsersIcon size={16} /></span>
              </div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
                {stats.total}
              </div>
            </div>

            <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aktif Operatörler</span>
                <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(2, 132, 199, 0.08)', color: '#0284c7' }}><Building2 size={16} /></span>
              </div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
                {stats.operators}
              </div>
            </div>

            <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sistem Yöneticileri</span>
                <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' }}><ShieldCheck size={16} /></span>
              </div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
                {stats.admins}
              </div>
            </div>

            <div className="stat-card-modern" style={{ padding: '16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pasif Hesaplar</span>
                <span style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(220, 38, 38, 0.08)', color: '#dc2626' }}><UserX size={16} /></span>
              </div>
              <div className="tabular-nums font-mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, var(--text-main))' }}>
                {stats.inactives}
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <TTFilterBar
            actions={
              (searchQuery || roleFilter !== 'all' || statusFilter !== 'all') ? (
                <button
                  onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  <X size={14} /> Filtreleri Sıfırla
                </button>
              ) : undefined
            }
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, var(--text-muted))' }} />
              <input
                type="text"
                placeholder="İsim, kullanıcı adı veya hat ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ height: '36px', paddingLeft: '32px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="form-input"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              style={{ width: '160px', height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
            >
              <option value="all">Tüm Roller</option>
              <option value="Admin">Yöneticiler</option>
              <option value="Operator">Operatörler</option>
              <option value="Viewer">İzleyiciler</option>
            </select>

            <select
              className="form-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ width: '150px', height: '36px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-subtle, var(--border-color))' }}
            >
              <option value="all">Tüm Durumlar</option>
              <option value="active">Yalnızca Aktif</option>
              <option value="inactive">Yalnızca Pasif</option>
            </select>
          </TTFilterBar>

          {/* Users Table */}
          {loading && users.length === 0 ? (
            <TTLoadingState text="Kullanıcılar yükleniyor..." />
          ) : filteredUsers.length === 0 ? (
            <TTEmptyState
              icon={<UsersIcon size={32} />}
              title={searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'Arama Sonucu Bulunamadı' : 'Kayıtlı Kullanıcı Yok'}
              description={searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'Seçtiğiniz filtreleme kriterlerine uygun kullanıcı kaydı bulunamadı.' : 'Sistemde henüz kayıtlı bir kullanıcı bulunmuyor.'}
            />
          ) : (
            <TTTable headers={['Kullanıcı', 'Kullanıcı Adı', 'Rol', 'Varsayılan İstasyon', 'Son Giriş', 'Durum', 'İşlemler']}>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <TTUserAvatar name={u.name} role={u.role} size="sm" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</span>
                        {currentUser?.id === u.id && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                            (Mevcut Oturum)
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                      @{u.username}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: u.role === 'Admin' ? '#6d28d9' : u.role === 'Operator' ? '#0369a1' : 'var(--text-muted)'
                    }}>
                      <Shield size={14} style={{ color: u.role === 'Admin' ? '#7c3aed' : u.role === 'Operator' ? '#0284c7' : 'inherit' }} />
                      {u.role === 'Admin' ? 'Yönetici' : u.role === 'Operator' ? 'Operatör' : 'İzleyici'}
                    </span>
                  </td>
                  <td>
                    {u.defaultStationName ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                        <Building2 size={14} style={{ color: '#0284c7' }} />
                        {u.defaultStationName}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: u.lastLoginAt ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <Clock size={13} style={{ color: '#94a3b8' }} />
                      {formatDateTime(u.lastLoginAt)}
                    </span>
                  </td>
                  <td>
                    <TTBadge variant={u.isActive ? 'success' : 'neutral'} size="sm">
                      {u.isActive ? 'Aktif' : 'Pasif'}
                    </TTBadge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(hasPermission('users.edit') || hasPermission('users.manage')) && (
                        <TTButton 
                          variant="secondary" 
                          size="sm" 
                          icon={<Edit size={14} />} 
                          onClick={() => handleEditOpen(u)}
                        >
                          Düzenle
                        </TTButton>
                      )}
                      {(hasPermission('users.delete') || hasPermission('users.manage')) && (
                        <TTButton
                          variant={u.isActive ? 'secondary' : 'primary'}
                          size="sm"
                          icon={u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                          disabled={currentUser?.id === u.id}
                          onClick={() => setToggleModalUser(u)}
                          title={currentUser?.id === u.id ? 'Kendi hesabınızı pasifleştiremezsiniz' : undefined}
                        >
                          {u.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                        </TTButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </TTTable>
          )}
        </div>
      )}

      {activeTab === 'matrix' && (
        <div style={{ marginTop: '10px' }}>
          <PermissionMatrix />
        </div>
      )}

      {/* CONFIRM TOGGLE STATUS MODAL */}
      <TTModal
        isOpen={!!toggleModalUser}
        onClose={() => setToggleModalUser(null)}
        title={toggleModalUser?.isActive ? 'Kullanıcı Hesabını Pasifleştir' : 'Kullanıcı Hesabını Aktifleştir'}
        maxWidth="460px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <TTButton variant="secondary" onClick={() => setToggleModalUser(null)}>Vazgeç</TTButton>
            <TTButton 
              variant={toggleModalUser?.isActive ? 'danger' : 'primary'} 
              onClick={confirmToggleActive}
              disabled={isToggling}
            >
              {isToggling ? 'İşleniyor...' : toggleModalUser?.isActive ? 'Hesabı Askıya Al (Pasif)' : 'Hesabı Aktifleştir'}
            </TTButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%', 
              backgroundColor: toggleModalUser?.isActive ? '#fee2e2' : '#dcfce7',
              color: toggleModalUser?.isActive ? '#dc2626' : '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              {toggleModalUser?.isActive ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
            </div>
            <div>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{toggleModalUser?.name}</h4>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                @{toggleModalUser?.username} • {toggleModalUser?.role === 'Admin' ? 'Yönetici' : toggleModalUser?.role === 'Operator' ? 'Operatör' : 'İzleyici'}
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
            {toggleModalUser?.isActive 
              ? 'Bu kullanıcı hesabını pasifleştirmek üzeresiniz. Pasif hesaplar sisteme giriş yapamaz ve paketleme istasyonlarında okutma gerçekleştiremez.' 
              : 'Bu kullanıcı hesabı tekrar aktif hale getirilecek ve sisteme giriş yapabilecektir.'}
          </p>
        </div>
      </TTModal>

      {/* CREATE USER DRAWER */}
      <TTDrawer
        isOpen={showCreateDrawer}
        onClose={() => setShowCreateDrawer(false)}
        title="Yeni Kullanıcı Ekle"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <TTButton variant="secondary" onClick={() => setShowCreateDrawer(false)}>İptal</TTButton>
            <TTButton variant="primary" type="submit" form="create-user-form">Kullanıcıyı Kaydet</TTButton>
          </div>
        }
      >
        {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}
        <form id="create-user-form" onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">İsim (Şahıs veya İstasyon Adı) *</label>
            <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Paketleme Hattı 4 veya Ahmet Yılmaz" />
          </div>
          <div className="form-group">
            <label className="form-label">Kullanıcı Adı *</label>
            <input type="text" className="form-input" required value={username} onChange={e => setUsername(e.target.value)} placeholder="paketleme4" />
          </div>
          <div className="form-group">
            <label className="form-label">Şifre (Min 6 Karakter) *</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Şifre Tekrarı *</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showConfirmPassword ? 'text' : 'password'} 
                className="form-input" 
                required 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="••••••••" 
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                title={showConfirmPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="Viewer">İzleyici (Viewer)</option>
              <option value="Operator">Operatör (Operator)</option>
              <option value="Admin">Yönetici (Admin)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Varsayılan İstasyon (Hat Eşleşmesi)</label>
            <select 
              className="form-input" 
              value={defaultStationId || ''} 
              onChange={e => setDefaultStationId(e.target.value || null)}
            >
              <option value="">-- İstasyon Seçilmedi (Esnek Hat) --</option>
              {stations.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Operatör oturum açtığında paketleme ekranında ilgili istasyon otomatik seçilecektir.
            </span>
          </div>
        </form>
      </TTDrawer>

      {/* EDIT USER DRAWER */}
      <TTDrawer
        isOpen={showEditDrawer}
        onClose={() => { setShowEditDrawer(false); setSelectedUser(null); }}
        title="Kullanıcıyı Düzenle"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <TTButton variant="secondary" onClick={() => { setShowEditDrawer(false); setSelectedUser(null); }}>İptal</TTButton>
            <TTButton variant="primary" type="submit" form="edit-user-form">Değişiklikleri Kaydet</TTButton>
          </div>
        }
      >
        {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}
        <form id="edit-user-form" onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">İsim *</label>
            <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Kullanıcı Adı *</label>
            <input type="text" className="form-input" required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Yeni Şifre (Değiştirmek İstemiyorsanız Boş Bırakın)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Yeni Şifre Tekrarı {password && '*'}</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showConfirmPassword ? 'text' : 'password'} 
                className="form-input" 
                required={!!password} 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="••••••••" 
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                title={showConfirmPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select 
              className="form-input" 
              value={role} 
              disabled={currentUser?.id === selectedUser?.id}
              onChange={e => setRole(e.target.value)}
            >
              <option value="Viewer">İzleyici (Viewer)</option>
              <option value="Operator">Operatör (Operator)</option>
              <option value="Admin">Yönetici (Admin)</option>
            </select>
            {currentUser?.id === selectedUser?.id && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                Güvenlik: Kendi yönetici rolünüzü değiştiremezsiniz.
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Varsayılan İstasyon (Hat Eşleşmesi)</label>
            <select 
              className="form-input" 
              value={defaultStationId || ''} 
              onChange={e => setDefaultStationId(e.target.value || null)}
            >
              <option value="">-- İstasyon Seçilmedi (Esnek Hat) --</option>
              {stations.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Operatör oturum açtığında paketleme ekranında ilgili istasyon otomatik seçilecektir.
            </span>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <input
              type="checkbox"
              id="isActiveCheckbox"
              checked={isActive}
              disabled={currentUser?.id === selectedUser?.id}
              onChange={e => setIsActive(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <label htmlFor="isActiveCheckbox" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Kullanıcı Hesabı Aktif</label>
          </div>
        </form>
      </TTDrawer>
    </div>
  );
};
