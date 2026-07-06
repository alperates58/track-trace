-- 008_Add_PrePrinted_Permissions.sql
INSERT INTO Permissions (Key, Module, Action, Description) VALUES
('scan.autoCarton', 'Scan', 'AutoCarton', 'Otomatik Koli Moduna erisim saglar.'),
('scan.prePrintedCarton', 'Scan', 'PrePrintedCarton', 'On Etiketli Koli Moduna erisim saglar.'),
('cartons.prePrint', 'Cartons', 'PrePrint', 'Siparis icin on etiket basma yetkisi.'),
('cartons.void', 'Cartons', 'Void', 'Koli iptal etme yetkisi.'),
('cartons.reprint', 'Cartons', 'Reprint', 'Koli etiketini tekrar basma yetkisi.')
ON CONFLICT DO NOTHING;

INSERT INTO RolePermissions (Role, PermissionKey) VALUES
('Admin', 'scan.autoCarton'),
('Operator', 'scan.autoCarton'),
('Admin', 'scan.prePrintedCarton'),
('Operator', 'scan.prePrintedCarton'),
('Admin', 'cartons.prePrint'),
('Operator', 'cartons.prePrint'),
('Admin', 'cartons.void'),
('Admin', 'cartons.reprint'),
('Operator', 'cartons.reprint')
ON CONFLICT DO NOTHING;
