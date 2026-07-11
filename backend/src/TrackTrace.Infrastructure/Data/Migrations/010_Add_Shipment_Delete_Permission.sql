INSERT INTO Permissions (Key, Module, Action, Description) VALUES
('shipments.delete', 'Depo & Sevkiyat', 'delete', 'İptal edilmiş sevkiyatı silme')
ON CONFLICT (Key) DO NOTHING;

INSERT INTO RolePermissions (Role, PermissionKey) VALUES
('Admin', 'shipments.delete')
ON CONFLICT (Role, PermissionKey) DO NOTHING;
