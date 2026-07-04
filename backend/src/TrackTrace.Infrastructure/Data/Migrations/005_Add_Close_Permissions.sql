-- Insert new permissions if they don't exist
INSERT INTO "Permissions" ("Key", "Group", "Action", "Description")
VALUES 
('cartons.close', 'Koli Yönetimi', 'close', 'Koli Yönetimi kapatma'),
('pallets.close', 'Palet Yönetimi', 'close', 'Palet Yönetimi kapatma')
ON CONFLICT ("Key") DO NOTHING;

-- Grant to Admin
INSERT INTO "RolePermissions" ("RoleName", "PermissionKey")
VALUES 
('Admin', 'cartons.close'), 
('Admin', 'pallets.close')
ON CONFLICT ("RoleName", "PermissionKey") DO NOTHING;

-- Grant to Operator
INSERT INTO "RolePermissions" ("RoleName", "PermissionKey")
VALUES 
('Operator', 'cartons.close'), 
('Operator', 'pallets.close')
ON CONFLICT ("RoleName", "PermissionKey") DO NOTHING;
