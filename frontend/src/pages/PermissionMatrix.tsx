import React, { useEffect, useState } from 'react';
import { TTPageHeader, TTCard } from '../components/common';
import { Check, Minus, ShieldAlert, Save, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CheckIcon = () => <Check size={18} style={{ color: '#10b981', margin: '0 auto' }} />;
const CrossIcon = () => <Minus size={18} style={{ color: '#64748b', margin: '0 auto', opacity: 0.5 }} />;

interface Permission {
  key: string;
  module: string;
  action: string;
  description: string;
}

interface RolePermission {
  role: string;
  permissionKey: string;
}

export const PermissionMatrix: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/permissions/matrix');
      setPermissions(res.data.permissions || []);
      setRolePermissions(res.data.rolePermissions || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Yetki matrisi yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const hasRolePerm = (role: string, key: string) => {
    return rolePermissions.some(rp => rp.role === role && rp.permissionKey === key);
  };

  const togglePermission = (role: string, key: string) => {
    if (!isAdmin) return;
    setRolePermissions(prev => {
      const exists = prev.some(rp => rp.role === role && rp.permissionKey === key);
      if (exists) {
        return prev.filter(rp => !(rp.role === role && rp.permissionKey === key));
      } else {
        return [...prev, { role, permissionKey: key }];
      }
    });
  };

  const saveMatrix = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.post('/api/permissions/matrix', { assignments: rolePermissions });
      // Show success somehow (toast etc if available, or just reload)
      await fetchMatrix();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Kaydetme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map(p => p.module)));
  const actionsList = ['view', 'create', 'edit', 'delete', 'print', 'export', 'manage'];

  if (loading) {
    return <div style={{ padding: '20px' }}>Yükleniyor...</div>;
  }

  return (
    <div>
      <TTPageHeader
        title="Yetki Matrisi"
        description="Sistemdeki tüm modüller için rol bazlı yetkilerin genel görünümü."
        actions={isAdmin ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchMatrix} disabled={saving} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={16} /> Yenile
            </button>
            <button onClick={saveMatrix} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        ) : undefined}
      />

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div style={{
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <ShieldAlert size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>Bilgilendirme</h4>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Bu ekran dinamik yetki matrisini gösterir. Yalnızca Admin rolüne sahip kullanıcılar değişiklik yapabilir.
          </p>
        </div>
      </div>

      <TTCard padding="none">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ padding: '16px', borderBottom: '2px solid var(--border-color)', borderRight: '1px solid var(--border-color)', textAlign: 'left', backgroundColor: 'var(--bg-secondary)', width: '200px' }}>Modül</th>
              <th colSpan={7} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>Admin (Yönetici)</th>
              <th colSpan={7} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>Operator (Operatör)</th>
              <th colSpan={7} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>Viewer (İzleyici)</th>
            </tr>
            <tr>
              {/* Actions Header for each role */}
              {[...Array(3)].map((_, i) => (
                <React.Fragment key={i}>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Görüntüleme">Gör.</th>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Oluşturma">Oluş.</th>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Düzenleme">Düz.</th>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Silme">Sil.</th>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yazdırma">Yaz.</th>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Dışa Aktarma">Exp.</th>
                  <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', borderRight: i < 2 ? '1px solid var(--border-color)' : 'none', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yönetim">Yön.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((moduleName, i) => {
              const modulePerms = permissions.filter(p => p.module === moduleName);
              const getPermKey = (action: string) => modulePerms.find(p => p.action === action)?.key;

              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, borderRight: '1px solid var(--border-color)' }}>{moduleName}</td>
                  
                  {['Admin', 'Operator', 'Viewer'].map((role, roleIdx) => (
                    <React.Fragment key={role}>
                      {actionsList.map((action, actionIdx) => {
                        const pKey = getPermKey(action);
                        const isChecked = pKey ? hasRolePerm(role, pKey) : false;
                        const isLast = actionIdx === actionsList.length - 1;
                        
                        return (
                          <td key={action} style={{ padding: '8px', borderRight: isLast && roleIdx < 2 ? '1px solid var(--border-color)' : 'none', textAlign: 'center' }}>
                            {pKey ? (
                              isAdmin ? (
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={() => togglePermission(role, pKey)} 
                                  style={{ cursor: 'pointer' }}
                                />
                              ) : (
                                isChecked ? <CheckIcon /> : <CrossIcon />
                              )
                            ) : (
                              <span style={{ color: '#ccc' }}>-</span>
                            )}
                          </td>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </TTCard>
    </div>
  );
};
