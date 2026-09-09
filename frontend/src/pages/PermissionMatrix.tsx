import { TTPageHeader, TTCard, TTButton, TTLoadingState, TTAlert } from '../components/common';
import { Check, Minus, ShieldAlert, Save, RefreshCw, Shield } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CheckIcon = () => <Check size={16} style={{ color: '#10b981', margin: '0 auto' }} />;
const CrossIcon = () => <Minus size={16} style={{ color: 'var(--text-secondary, #64748b)', margin: '0 auto', opacity: 0.3 }} />;

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
      setPermissions(res.permissions || []);
      setRolePermissions(res.rolePermissions || []);
    } catch (err: any) {
      setError(err.message || 'Yetki matrisi yüklenirken hata oluştu.');
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
    if (!isAdmin || role === 'Admin') return;
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
      await fetchMatrix();
    } catch (err: any) {
      setError(err.message || 'Kaydetme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map(p => p.module)));
  const actionsList = ['view', 'create', 'edit', 'delete', 'print', 'export', 'manage'];

  if (loading) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
        <TTLoadingState text="Yetki matrisi yükleniyor..." />
      </div>
    );
  }

  return (
    <div className="permission-matrix-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <TTPageHeader
        title="Rol ve Yetki Matrisi"
        description="Sistemdeki tüm modüller için rol bazlı granular yetkilerin genel görünümü ve atamaları."
        actions={isAdmin ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <TTButton onClick={fetchMatrix} disabled={saving} variant="secondary" size="md" icon={<RefreshCw size={14} />}>
              Yenile
            </TTButton>
            <TTButton onClick={saveMatrix} disabled={saving} variant="primary" size="md" icon={<Save size={14} />}>
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </TTButton>
          </div>
        ) : undefined}
      />

      {error && (
        <div style={{ marginBottom: '16px' }}>
          <TTAlert variant="danger" title="Hata">
            {error}
          </TTAlert>
        </div>
      )}

      <div style={{
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        border: '1px solid var(--border-subtle, rgba(59, 130, 246, 0.2))',
        borderRadius: 'var(--radius-sm, 6px)',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Shield size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, var(--text-muted))', lineHeight: 1.4 }}>
          Bu ekran dinamik yetki matrisini gösterir. Yalnızca <strong>Yönetici (Admin)</strong> rolüne sahip kullanıcılar yetkilerde değişiklik yapabilir. Admin rolü tüm yetkilere doğal olarak sahiptir.
        </span>
      </div>

      <TTCard padding="none" style={{ overflow: 'hidden', border: '1px solid var(--border-subtle, var(--border-color))' }}>
        <div className="permission-matrix-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', borderRight: '1px solid var(--border-subtle, var(--border-color))', textAlign: 'left', backgroundColor: 'var(--bg-main)', width: '200px', fontWeight: 600, color: 'var(--text-primary, var(--text-main))' }}>Modül</th>
              <th colSpan={7} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', borderRight: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, color: 'var(--text-primary, var(--text-main))' }}>Admin (Yönetici)</th>
              <th colSpan={7} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', borderRight: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, color: 'var(--text-primary, var(--text-main))' }}>Operator (Operatör)</th>
              <th colSpan={7} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, color: 'var(--text-primary, var(--text-main))' }}>Viewer (İzleyici)</th>
            </tr>
            <tr>
              {/* Actions Header for each role */}
              {[...Array(3)].map((_, i) => (
                <React.Fragment key={i}>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Görüntüleme">Gör.</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Oluşturma">Oluş.</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Düzenleme">Düz.</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Silme">Sil.</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Yazdırma">Yaz.</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Dışa Aktarma">Exp.</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-subtle, var(--border-color))', borderRight: i < 2 ? '1px solid var(--border-subtle, var(--border-color))' : 'none', backgroundColor: 'var(--bg-main)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary, var(--text-muted))' }} title="Yönetim">Yön.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((moduleName, i) => {
              const modulePerms = permissions.filter(p => p.module === moduleName);
              const getPermKey = (action: string) => modulePerms.find(p => p.action === action)?.key;

              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle, var(--border-color))' }}>
                  <td style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary, var(--text-main))', borderRight: '1px solid var(--border-subtle, var(--border-color))' }}>{moduleName}</td>
                  
                  {['Admin', 'Operator', 'Viewer'].map((role, roleIdx) => (
                    <React.Fragment key={role}>
                      {actionsList.map((action, actionIdx) => {
                        const pKey = getPermKey(action);
                        const isChecked = pKey ? hasRolePerm(role, pKey) : false;
                        const isLast = actionIdx === actionsList.length - 1;
                        
                        return (
                          <td key={action} style={{ padding: '8px 6px', borderRight: isLast && roleIdx < 2 ? '1px solid var(--border-subtle, var(--border-color))' : 'none', textAlign: 'center' }}>
                            {pKey ? (
                              role === 'Admin' ? (
                                <input 
                                  type="checkbox" 
                                  checked={true} 
                                  disabled={true}
                                  title="Yönetici (Admin) rolü tüm yetkilere tam erişime sahiptir ve kısıtlanamaz."
                                  style={{ cursor: 'not-allowed', accentColor: 'var(--primary)' }}
                                />
                              ) : isAdmin ? (
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={() => togglePermission(role, pKey)} 
                                  style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                              ) : (
                                isChecked ? <CheckIcon /> : <CrossIcon />
                              )
                            ) : (
                              <span style={{ color: 'var(--text-secondary, #94a3b8)', opacity: 0.4 }}>-</span>
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
