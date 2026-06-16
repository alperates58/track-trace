import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Shield, CheckCircle, XCircle, Edit } from 'lucide-react';

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
}

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    setRole('Viewer');
    setIsActive(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await api.post('/api/users', { name, username, password, role });
      setShowCreateModal(false);
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
    setPassword(''); // Empty password, only changes if filled
    setRole(u.role);
    setIsActive(u.isActive);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError(null);

    try {
      await api.put(`/api/users/${selectedUser?.id}`, {
        name,
        username,
        password: password || null,
        role,
        isActive
      });
      setShowEditModal(false);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Kullanıcı Yönetimi</h2>
          <p style={{ color: 'var(--text-muted)' }}>Sistem kullanıcılarını ekleyin, rollerini ve erişim yetkilerini yönetin.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
          <UserPlus size={18} /> Yeni Kullanıcı Ekle
        </button>
      </div>

      {loading && users.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Kullanıcılar yükleniyor...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>İsim</th>
                <th>Kullanıcı Adı</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>@{u.username}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} style={{ color: u.role === 'Admin' ? 'var(--primary)' : 'var(--text-muted)' }} />
                      {u.role === 'Admin' ? 'Yönetici' : u.role === 'Operator' ? 'Operatör' : 'İzleyici'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-completed' : 'badge-draft'}`}>
                      {u.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleEditOpen(u)}>
                        <Edit size={14} /> Düzenle
                      </button>
                      <button
                        className={`btn ${u.isActive ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding: '6px 10px', minWidth: '100px' }}
                        disabled={currentUser?.id === u.id}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        {u.isActive ? ' Pasif Yap' : ' Aktif Yap'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- CREATE USER MODAL --- */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Yeni Kullanıcı Ekle</h3>
            
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <label className="form-label">Rol *</label>
                <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="Viewer">İzleyici (Viewer)</option>
                  <option value="Operator">Operatör (Operator)</option>
                  <option value="Admin">Yönetici (Admin)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {showEditModal && selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Kullanıcıyı Düzenle</h3>
            
            {error && <div style={{ color: 'var(--danger-text)', backgroundColor: 'var(--danger-bg)', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <label className="form-label">Rol *</label>
                <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="Viewer">İzleyici (Viewer)</option>
                  <option value="Operator">Operatör (Operator)</option>
                  <option value="Admin">Yönetici (Admin)</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="isActiveCheckbox"
                  checked={isActive}
                  disabled={currentUser?.id === selectedUser?.id}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveCheckbox" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Kullanıcı Hesabı Aktif</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setSelectedUser(null); }}>İptal</button>
                <button type="submit" className="btn btn-primary">Güncelle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
