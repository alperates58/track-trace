CREATE SEQUENCE IF NOT EXISTS shipment_no_seq START WITH 1;

CREATE TABLE IF NOT EXISTS Shipments (
    Id UUID PRIMARY KEY,
    ShipmentNo TEXT UNIQUE NOT NULL,
    Status TEXT NOT NULL,
    CreatedBy UUID REFERENCES Users(Id) ON DELETE SET NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CompletedBy UUID REFERENCES Users(Id) ON DELETE SET NULL,
    CompletedAt TIMESTAMPTZ,
    CancelledBy UUID REFERENCES Users(Id) ON DELETE SET NULL,
    CancelledAt TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ShipmentItems (
    Id UUID PRIMARY KEY,
    ShipmentId UUID NOT NULL REFERENCES Shipments(Id) ON DELETE CASCADE,
    CartonId UUID REFERENCES Cartons(Id) ON DELETE RESTRICT,
    PalletId UUID REFERENCES Pallets(Id) ON DELETE RESTRICT,
    ScannedBy UUID REFERENCES Users(Id) ON DELETE SET NULL,
    ScannedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    RemovedBy UUID REFERENCES Users(Id) ON DELETE SET NULL,
    RemovedAt TIMESTAMPTZ,
    CONSTRAINT CK_ShipmentItems_OneEntity CHECK (num_nonnulls(CartonId, PalletId) = 1)
);

ALTER TABLE Cartons ADD COLUMN IF NOT EXISTS ShippedAt TIMESTAMPTZ;
ALTER TABLE Cartons ADD COLUMN IF NOT EXISTS ShippedBy UUID REFERENCES Users(Id) ON DELETE SET NULL;
ALTER TABLE Pallets ADD COLUMN IF NOT EXISTS ShippedAt TIMESTAMPTZ;
ALTER TABLE Pallets ADD COLUMN IF NOT EXISTS ShippedBy UUID REFERENCES Users(Id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS IX_Shipments_Status_CreatedAt ON Shipments(Status, CreatedAt DESC);
CREATE INDEX IF NOT EXISTS IX_ShipmentItems_ShipmentId ON ShipmentItems(ShipmentId) WHERE RemovedAt IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS UQ_ShipmentItems_ActiveCarton ON ShipmentItems(CartonId) WHERE CartonId IS NOT NULL AND RemovedAt IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS UQ_ShipmentItems_ActivePallet ON ShipmentItems(PalletId) WHERE PalletId IS NOT NULL AND RemovedAt IS NULL;

INSERT INTO Permissions (Key, Module, Action, Description) VALUES
('shipments.view', 'Depo & Sevkiyat', 'view', 'Sevkiyatları görüntüleme'),
('shipments.create', 'Depo & Sevkiyat', 'create', 'Yeni sevkiyat oluşturma'),
('shipments.scan', 'Depo & Sevkiyat', 'scan', 'Sevkiyata koli veya palet okutma'),
('shipments.complete', 'Depo & Sevkiyat', 'complete', 'Sevkiyatı tamamlama'),
('shipments.cancel', 'Depo & Sevkiyat', 'cancel', 'Taslak sevkiyatı iptal etme')
ON CONFLICT (Key) DO NOTHING;

INSERT INTO RolePermissions (Role, PermissionKey) VALUES
('Admin', 'shipments.view'), ('Admin', 'shipments.create'), ('Admin', 'shipments.scan'), ('Admin', 'shipments.complete'), ('Admin', 'shipments.cancel'),
('Operator', 'shipments.view'), ('Operator', 'shipments.create'), ('Operator', 'shipments.scan'), ('Operator', 'shipments.complete'), ('Operator', 'shipments.cancel'),
('Viewer', 'shipments.view')
ON CONFLICT (Role, PermissionKey) DO NOTHING;
