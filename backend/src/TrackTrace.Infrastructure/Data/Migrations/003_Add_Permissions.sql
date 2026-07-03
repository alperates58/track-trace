CREATE TABLE IF NOT EXISTS Permissions (
    Key TEXT PRIMARY KEY,
    Module TEXT NOT NULL,
    Action TEXT NOT NULL,
    Description TEXT
);

CREATE TABLE IF NOT EXISTS RolePermissions (
    Role TEXT NOT NULL,
    PermissionKey TEXT NOT NULL REFERENCES Permissions(Key) ON DELETE CASCADE,
    PRIMARY KEY (Role, PermissionKey)
);

INSERT INTO Permissions (Key, Module, Action, Description) VALUES
('dashboard.view', 'Dashboard', 'view', 'Dashboard görüntüleme'),

('orders.view', 'Sipariş Yönetimi', 'view', 'Sipariş Yönetimi görüntüleme'),
('orders.create', 'Sipariş Yönetimi', 'create', 'Sipariş Yönetimi oluşturma'),
('orders.edit', 'Sipariş Yönetimi', 'edit', 'Sipariş Yönetimi düzenleme'),
('orders.delete', 'Sipariş Yönetimi', 'delete', 'Sipariş Yönetimi silme'),
('orders.print', 'Sipariş Yönetimi', 'print', 'Sipariş Yönetimi yazdırma'),
('orders.export', 'Sipariş Yönetimi', 'export', 'Sipariş Yönetimi dışa aktarma'),
('orders.manage', 'Sipariş Yönetimi', 'manage', 'Sipariş Yönetimi yönetim'),

('scan.view', 'Ürün Okutma', 'view', 'Ürün Okutma görüntüleme'),
('scan.create', 'Ürün Okutma', 'create', 'Ürün Okutma oluşturma'),
('scan.edit', 'Ürün Okutma', 'edit', 'Ürün Okutma düzenleme'),
('scan.delete', 'Ürün Okutma', 'delete', 'Ürün Okutma silme'),
('scan.print', 'Ürün Okutma', 'print', 'Ürün Okutma yazdırma'),

('cartons.view', 'Koli Yönetimi', 'view', 'Koli Yönetimi görüntüleme'),
('cartons.create', 'Koli Yönetimi', 'create', 'Koli Yönetimi oluşturma'),
('cartons.edit', 'Koli Yönetimi', 'edit', 'Koli Yönetimi düzenleme'),
('cartons.delete', 'Koli Yönetimi', 'delete', 'Koli Yönetimi silme'),
('cartons.print', 'Koli Yönetimi', 'print', 'Koli Yönetimi yazdırma'),
('cartons.export', 'Koli Yönetimi', 'export', 'Koli Yönetimi dışa aktarma'),
('cartons.manage', 'Koli Yönetimi', 'manage', 'Koli Yönetimi yönetim'),

('pallets.view', 'Palet Yönetimi', 'view', 'Palet Yönetimi görüntüleme'),
('pallets.create', 'Palet Yönetimi', 'create', 'Palet Yönetimi oluşturma'),
('pallets.edit', 'Palet Yönetimi', 'edit', 'Palet Yönetimi düzenleme'),
('pallets.delete', 'Palet Yönetimi', 'delete', 'Palet Yönetimi silme'),
('pallets.print', 'Palet Yönetimi', 'print', 'Palet Yönetimi yazdırma'),
('pallets.export', 'Palet Yönetimi', 'export', 'Palet Yönetimi dışa aktarma'),
('pallets.manage', 'Palet Yönetimi', 'manage', 'Palet Yönetimi yönetim'),

('traceability.view', 'İzlenebilirlik Merkezi', 'view', 'İzlenebilirlik Merkezi görüntüleme'),
('traceability.print', 'İzlenebilirlik Merkezi', 'print', 'İzlenebilirlik Merkezi yazdırma'),
('traceability.export', 'İzlenebilirlik Merkezi', 'export', 'İzlenebilirlik Merkezi dışa aktarma'),

('reports.view', 'Raporlama', 'view', 'Raporlama görüntüleme'),
('reports.create', 'Raporlama', 'create', 'Raporlama oluşturma'),
('reports.edit', 'Raporlama', 'edit', 'Raporlama düzenleme'),
('reports.delete', 'Raporlama', 'delete', 'Raporlama silme'),
('reports.print', 'Raporlama', 'print', 'Raporlama yazdırma'),
('reports.export', 'Raporlama', 'export', 'Raporlama dışa aktarma'),
('reports.manage', 'Raporlama', 'manage', 'Raporlama yönetim'),

('generator.view', 'DataMatrix Üretici', 'view', 'DataMatrix Üretici görüntüleme'),
('generator.create', 'DataMatrix Üretici', 'create', 'DataMatrix Üretici oluşturma'),
('generator.edit', 'DataMatrix Üretici', 'edit', 'DataMatrix Üretici düzenleme'),
('generator.delete', 'DataMatrix Üretici', 'delete', 'DataMatrix Üretici silme'),
('generator.print', 'DataMatrix Üretici', 'print', 'DataMatrix Üretici yazdırma'),
('generator.export', 'DataMatrix Üretici', 'export', 'DataMatrix Üretici dışa aktarma'),
('generator.manage', 'DataMatrix Üretici', 'manage', 'DataMatrix Üretici yönetim'),

('users.view', 'Kullanıcı Yönetimi', 'view', 'Kullanıcı Yönetimi görüntüleme'),
('users.create', 'Kullanıcı Yönetimi', 'create', 'Kullanıcı Yönetimi oluşturma'),
('users.edit', 'Kullanıcı Yönetimi', 'edit', 'Kullanıcı Yönetimi düzenleme'),
('users.delete', 'Kullanıcı Yönetimi', 'delete', 'Kullanıcı Yönetimi silme'),
('users.manage', 'Kullanıcı Yönetimi', 'manage', 'Kullanıcı Yönetimi yönetim'),

('audit.view', 'Audit Center', 'view', 'Audit Center görüntüleme'),
('audit.print', 'Audit Center', 'print', 'Audit Center yazdırma'),
('audit.export', 'Audit Center', 'export', 'Audit Center dışa aktarma'),
('audit.manage', 'Audit Center', 'manage', 'Audit Center yönetim'),

('system.view', 'Sistem Bilgisi', 'view', 'Sistem Bilgisi görüntüleme'),
('system.manage', 'Sistem Bilgisi', 'manage', 'Sistem Bilgisi yönetim')
ON CONFLICT (Key) DO NOTHING;

INSERT INTO RolePermissions (Role, PermissionKey) VALUES
('Admin', 'dashboard.view'),
('Admin', 'orders.view'), ('Admin', 'orders.create'), ('Admin', 'orders.edit'), ('Admin', 'orders.delete'), ('Admin', 'orders.print'), ('Admin', 'orders.export'), ('Admin', 'orders.manage'),
('Admin', 'scan.view'), ('Admin', 'scan.create'), ('Admin', 'scan.edit'), ('Admin', 'scan.delete'), ('Admin', 'scan.print'),
('Admin', 'cartons.view'), ('Admin', 'cartons.create'), ('Admin', 'cartons.edit'), ('Admin', 'cartons.delete'), ('Admin', 'cartons.print'), ('Admin', 'cartons.export'), ('Admin', 'cartons.manage'),
('Admin', 'pallets.view'), ('Admin', 'pallets.create'), ('Admin', 'pallets.edit'), ('Admin', 'pallets.delete'), ('Admin', 'pallets.print'), ('Admin', 'pallets.export'), ('Admin', 'pallets.manage'),
('Admin', 'traceability.view'), ('Admin', 'traceability.print'), ('Admin', 'traceability.export'),
('Admin', 'reports.view'), ('Admin', 'reports.create'), ('Admin', 'reports.edit'), ('Admin', 'reports.delete'), ('Admin', 'reports.print'), ('Admin', 'reports.export'), ('Admin', 'reports.manage'),
('Admin', 'generator.view'), ('Admin', 'generator.create'), ('Admin', 'generator.edit'), ('Admin', 'generator.delete'), ('Admin', 'generator.print'), ('Admin', 'generator.export'), ('Admin', 'generator.manage'),
('Admin', 'users.view'), ('Admin', 'users.create'), ('Admin', 'users.edit'), ('Admin', 'users.delete'), ('Admin', 'users.manage'),
('Admin', 'audit.view'), ('Admin', 'audit.print'), ('Admin', 'audit.export'), ('Admin', 'audit.manage'),
('Admin', 'system.view'), ('Admin', 'system.manage'),

('Operator', 'dashboard.view'),
('Operator', 'orders.view'),
('Operator', 'scan.view'), ('Operator', 'scan.create'), ('Operator', 'scan.edit'), ('Operator', 'scan.delete'), ('Operator', 'scan.print'),
('Operator', 'cartons.view'), ('Operator', 'cartons.create'), ('Operator', 'cartons.print'),
('Operator', 'pallets.view'), ('Operator', 'pallets.create'), ('Operator', 'pallets.print'),
('Operator', 'traceability.view'),
('Operator', 'reports.view'), ('Operator', 'reports.print'), ('Operator', 'reports.export'),
('Operator', 'generator.view'), ('Operator', 'generator.create'), ('Operator', 'generator.print'),

('Viewer', 'dashboard.view'),
('Viewer', 'orders.view'),
('Viewer', 'cartons.view'),
('Viewer', 'pallets.view'),
('Viewer', 'traceability.view'),
('Viewer', 'reports.view')
ON CONFLICT (Role, PermissionKey) DO NOTHING;
