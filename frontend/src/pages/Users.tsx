import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Shield, CheckCircle, XCircle, Edit, Users as UsersIcon, List, LayoutGrid } from 'lucide-react';
import {
  TTPageHeader,
  TTButton,
  TTBadge,
  TTTable,
  TTUserAvatar,
  TTDrawer,
  TTLoadingState,
  TTEmptyState
} from '../components/common';

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
}

import { PermissionMatrix } from './PermissionMatrix';

export const Users: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'matrix'>('list');

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setRole('Viewer');
    setIsActive(true);
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
      await api.post('/api/users', { name, username, password, role });
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
      await api.put(`/api/users/${selectedUser?.id}`, {
        name,
        username,
        password: password || null,
        role,
        isActive
      });
      setShowEditDrawer(false);
      setSelectedUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı güncellenirken bir hata oluştu.');
    }
  };

  const handleToggleActive = async (u: User) => {
    if (currentUser?.id === u.id) {
      alert('Kendi hesabınızı pasifleştiremezsiniz.');
      return;
    }
    if (!confirm(`${u.name} kullanıcısının aktiflik durumunu değiştirmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      await api.post(`/api/users/${u.id}/toggle`, {});
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Kullanıcı durumu güncellenemedi.');
    }
  };

  return (
    <div>
      <TTPageHeader
        title="Kullanıcı Yönetimi"
        description="Sistem kullanıcılarını ekleyin, rollerini ve erişim yetkilerini yönetin."
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'list' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.95rem'
          }}
        >
          <List size={18} /> Kullanıcı Listesi
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'matrix' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'matrix' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.95rem'
          }}
        >
          <LayoutGrid size={18} /> Rol ve Yetki Matrisi
        </button>
      </div>

      {activeTab === 'list' && (
        <>
          {loading && users.length === 0 ? (
            <TTLoadingState text="Kullanıcılar yükleniyor..." />
          ) : users.length === 0 ? (
            <TTEmptyState
              icon={<UsersIcon size={32} />}
              title="Kayıtlı Kullanıcı Yok"
              description="Sistemde henüz kayıtlı bir kullanıcı bulunmuyor."
            />
          ) : (
            <TTTable headers={['Kullanıcı', 'Kullanıcı Adı', 'Rol', 'Durum', 'İşlemler']}>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <TTUserAvatar name={u.name} size="sm" isActive={u.isActive} />
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </div>
                  </td>
                  <td><span style={{ color: 'var(--text-muted)' }}>@{u.username}</span></td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                      <Shield size={14} style={{ color: u.role === 'Admin' ? 'var(--primary)' : 'inherit' }} />
                      {u.role === 'Admin' ? 'Yönetici' : u.role === 'Operator' ? 'Operatör' : 'İzleyici'}
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
                        <TTButton variant="secondary" size="sm" icon={<Edit size={14} />} onClick={() => handleEditOpen(u)}>
                          Düzenle
                        </TTButton>
                      )}
                      {(hasPermission('users.delete') || hasPermission('users.manage')) && (
                        <TTButton
                          variant={u.isActive ? 'secondary' : 'primary'}
                          size="sm"
                          icon={u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                          disabled={currentUser?.id === u.id}
                          onClick={() => handleToggleActive(u)}
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
        </>
      )}

      {activeTab === 'matrix' && (
        <div style={{ marginTop: '20px' }}>
          <PermissionMatrix />
        </div>
      )}

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
            <label className="form-label">İsim *</label>
            <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} placeholder="Ahmet Yılmaz" />
          </div>
          <div className="form-group">
            <label className="form-label">Kullanıcı Adı *</label>
            <input type="text" className="form-input" required value={username} onChange={e => setUsername(e.target.value)} placeholder="ahmetyilmaz" />
          </div>
          <div className="form-group">
            <label className="form-label">Şifre (Min 6 Karakter) *</label>
            <input type="password" className="form-input" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label className="form-label">Şifre Tekrarı *</label>
            <input type="password" className="form-input" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="Viewer">İzleyici (Viewer)</option>
              <option value="Operator">Operatör (Operator)</option>
              <option value="Admin">Yönetici (Admin)</option>
            </select>
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
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label className="form-label">Yeni Şifre Tekrarı {password && '*'}</label>
            <input type="password" className="form-input" required={!!password} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label className="form-label">Rol *</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="Viewer">İzleyici (Viewer)</option>
              <option value="Operator">Operatör (Operator)</option>
              <option value="Admin">Yönetici (Admin)</option>
            </select>
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
