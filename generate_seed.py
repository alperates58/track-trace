matrixData = [
  { 'module': 'Dashboard', 'key_prefix': 'dashboard', 'admin': ['view'], 'operator': ['view'], 'viewer': ['view'] },
  { 'module': 'Sipariş Yönetimi', 'key_prefix': 'orders', 'admin': ['view','create','edit','delete','print','export','manage'], 'operator': ['view'], 'viewer': ['view'] },
  { 'module': 'Ürün Okutma', 'key_prefix': 'scan', 'admin': ['view','create','edit','delete','print'], 'operator': ['view','create','edit','delete','print'], 'viewer': [] },
  { 'module': 'Koli Yönetimi', 'key_prefix': 'cartons', 'admin': ['view','create','edit','delete','print','export','manage'], 'operator': ['view','create','print'], 'viewer': ['view'] },
  { 'module': 'Palet Yönetimi', 'key_prefix': 'pallets', 'admin': ['view','create','edit','delete','print','export','manage'], 'operator': ['view','create','print'], 'viewer': ['view'] },
  { 'module': 'İzlenebilirlik Merkezi', 'key_prefix': 'traceability', 'admin': ['view','print','export'], 'operator': ['view'], 'viewer': ['view'] },
  { 'module': 'Raporlama', 'key_prefix': 'reports', 'admin': ['view','create','edit','delete','print','export','manage'], 'operator': ['view','print','export'], 'viewer': ['view'] },
  { 'module': 'DataMatrix Üretici', 'key_prefix': 'generator', 'admin': ['view','create','edit','delete','print','export','manage'], 'operator': ['view','create','print'], 'viewer': [] },
  { 'module': 'Kullanıcı Yönetimi', 'key_prefix': 'users', 'admin': ['view','create','edit','delete','manage'], 'operator': [], 'viewer': [] },
  { 'module': 'Audit Center', 'key_prefix': 'audit', 'admin': ['view','print','export','manage'], 'operator': [], 'viewer': [] },
  { 'module': 'Sistem Bilgisi', 'key_prefix': 'system', 'admin': ['view','manage'], 'operator': [], 'viewer': [] }
]

actions_all = ['view', 'create', 'edit', 'delete', 'print', 'export', 'manage']

out = []
out.append('-- Permissions Table')
out.append('CREATE TABLE IF NOT EXISTS Permissions (')
out.append('    Key TEXT PRIMARY KEY,')
out.append('    Module TEXT NOT NULL,')
out.append('    Action TEXT NOT NULL,')
out.append('    Description TEXT')
out.append(');')
out.append('')
out.append('CREATE TABLE IF NOT EXISTS RolePermissions (')
out.append('    Role TEXT NOT NULL,')
out.append('    PermissionKey TEXT NOT NULL REFERENCES Permissions(Key) ON DELETE CASCADE,')
out.append('    PRIMARY KEY (Role, PermissionKey)')
out.append(');')
out.append('')
out.append('-- Seed Permissions')
out.append('INSERT INTO Permissions (Key, Module, Action, Description) VALUES')
permissions = []
for m in matrixData:
    for a in actions_all:
        desc = m["module"] + " " + a.capitalize()
        permissions.append(f"('{m['key_prefix']}.{a}', '{m['module']}', '{a}', '{desc}')")
out.append(',\\n'.join(permissions) + '\\nON CONFLICT DO NOTHING;')

out.append('')
out.append('-- Seed RolePermissions')
out.append('INSERT INTO RolePermissions (Role, PermissionKey) VALUES')
role_perms = []
for m in matrixData:
    for a in m['admin']: role_perms.append(f"('Admin', '{m['key_prefix']}.{a}')")
    for a in m['operator']: role_perms.append(f"('Operator', '{m['key_prefix']}.{a}')")
    for a in m['viewer']: role_perms.append(f"('Viewer', '{m['key_prefix']}.{a}')")

out.append(',\\n'.join(role_perms) + '\\nON CONFLICT DO NOTHING;')

with open('backend/src/TrackTrace.Infrastructure/Data/Migrations/003_Add_Permissions.sql', 'w', encoding='utf-8') as f:
    f.write('\\n'.join(out) + '\\n')

