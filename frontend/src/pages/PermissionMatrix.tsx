import React from 'react';
import { TTPageHeader, TTCard } from '../components/common';
import { Check, Minus, ShieldAlert } from 'lucide-react';

const CheckIcon = () => <Check size={18} style={{ color: '#10b981', margin: '0 auto' }} />;
const CrossIcon = () => <Minus size={18} style={{ color: '#64748b', margin: '0 auto', opacity: 0.5 }} />;

interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
  manage: boolean;
}

interface ModulePermissions {
  module: string;
  admin: Permission;
  operator: Permission;
  viewer: Permission;
}

const matrixData: ModulePermissions[] = [
  {
    module: 'Dashboard',
    admin: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    operator: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    viewer: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Sipariş Yönetimi',
    admin: { view: true, create: true, edit: true, delete: true, print: true, export: true, manage: true },
    operator: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    viewer: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Ürün Okutma',
    admin: { view: true, create: true, edit: true, delete: true, print: true, export: false, manage: false },
    operator: { view: true, create: true, edit: true, delete: true, print: true, export: false, manage: false },
    viewer: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Koli Yönetimi',
    admin: { view: true, create: true, edit: true, delete: true, print: true, export: true, manage: true },
    operator: { view: true, create: true, edit: false, delete: false, print: true, export: false, manage: false },
    viewer: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Palet Yönetimi',
    admin: { view: true, create: true, edit: true, delete: true, print: true, export: true, manage: true },
    operator: { view: true, create: true, edit: false, delete: false, print: true, export: false, manage: false },
    viewer: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'İzlenebilirlik Merkezi',
    admin: { view: true, create: false, edit: false, delete: false, print: true, export: true, manage: false },
    operator: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    viewer: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Raporlama',
    admin: { view: true, create: true, edit: true, delete: true, print: true, export: true, manage: true },
    operator: { view: true, create: false, edit: false, delete: false, print: true, export: true, manage: false },
    viewer: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'DataMatrix Üretici',
    admin: { view: true, create: true, edit: true, delete: true, print: true, export: true, manage: true },
    operator: { view: true, create: true, edit: false, delete: false, print: true, export: false, manage: false },
    viewer: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Kullanıcı Yönetimi',
    admin: { view: true, create: true, edit: true, delete: true, print: false, export: false, manage: true },
    operator: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    viewer: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Audit Center',
    admin: { view: true, create: false, edit: false, delete: false, print: true, export: true, manage: true },
    operator: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    viewer: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  },
  {
    module: 'Sistem Bilgisi',
    admin: { view: true, create: false, edit: false, delete: false, print: false, export: false, manage: true },
    operator: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false },
    viewer: { view: false, create: false, edit: false, delete: false, print: false, export: false, manage: false }
  }
];

export const PermissionMatrix: React.FC = () => {
  return (
    <div>
      <TTPageHeader
        title="Yetki Matrisi"
        description="Sistemdeki tüm modüller için rol bazlı yetkilerin genel görünümü."
      />

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
            Bu ekran mevcut statik rol yapısını gösterir. Dinamik yetki düzenleme sonraki fazdadır.
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
              {/* Admin Actions */}
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Görüntüleme">Gör.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Oluşturma">Oluş.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Düzenleme">Düz.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Silme">Sil.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yazdırma">Yaz.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Dışa Aktarma">Exp.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yönetim">Yön.</th>
              {/* Operator Actions */}
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Görüntüleme">Gör.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Oluşturma">Oluş.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Düzenleme">Düz.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Silme">Sil.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yazdırma">Yaz.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Dışa Aktarma">Exp.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yönetim">Yön.</th>
              {/* Viewer Actions */}
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Görüntüleme">Gör.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Oluşturma">Oluş.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Düzenleme">Düz.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Silme">Sil.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yazdırma">Yaz.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Dışa Aktarma">Exp.</th>
              <th style={{ padding: '12px 8px', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 500 }} title="Yönetim">Yön.</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                <td style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, borderRight: '1px solid var(--border-color)' }}>{row.module}</td>
                {/* Admin */}
                <td style={{ padding: '8px' }}>{row.admin.view ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.admin.create ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.admin.edit ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.admin.delete ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.admin.print ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.admin.export ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{row.admin.manage ? <CheckIcon /> : <CrossIcon />}</td>
                {/* Operator */}
                <td style={{ padding: '8px' }}>{row.operator.view ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.operator.create ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.operator.edit ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.operator.delete ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.operator.print ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.operator.export ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{row.operator.manage ? <CheckIcon /> : <CrossIcon />}</td>
                {/* Viewer */}
                <td style={{ padding: '8px' }}>{row.viewer.view ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.viewer.create ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.viewer.edit ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.viewer.delete ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.viewer.print ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.viewer.export ? <CheckIcon /> : <CrossIcon />}</td>
                <td style={{ padding: '8px' }}>{row.viewer.manage ? <CheckIcon /> : <CrossIcon />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </TTCard>
    </div>
  );
};
