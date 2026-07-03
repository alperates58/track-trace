INSERT INTO Permissions (Key, Module, Action, Description) VALUES
('stations.view', 'İstasyon Yönetimi', 'view', 'İstasyon Yönetimi görüntüleme'),
('stations.create', 'İstasyon Yönetimi', 'create', 'İstasyon Yönetimi oluşturma'),
('stations.edit', 'İstasyon Yönetimi', 'edit', 'İstasyon Yönetimi düzenleme'),
('stations.delete', 'İstasyon Yönetimi', 'delete', 'İstasyon Yönetimi silme'),

('permissions.view', 'Yetki Matrisi', 'view', 'Yetki Matrisi görüntüleme'),
('permissions.manage', 'Yetki Matrisi', 'manage', 'Yetki Matrisi yönetim')
ON CONFLICT (Key) DO NOTHING;

INSERT INTO RolePermissions (Role, PermissionKey) VALUES
('Admin', 'stations.view'), ('Admin', 'stations.create'), ('Admin', 'stations.edit'), ('Admin', 'stations.delete'),
('Admin', 'permissions.view'), ('Admin', 'permissions.manage')
ON CONFLICT (Role, PermissionKey) DO NOTHING;
