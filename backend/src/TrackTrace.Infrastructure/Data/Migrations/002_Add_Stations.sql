BEGIN;

-- 1. Create Stations table
CREATE TABLE IF NOT EXISTS Stations (
    Id UUID PRIMARY KEY,
    Name TEXT NOT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert Default Station
INSERT INTO Stations (Id, Name, IsActive, CreatedAt)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Ana İstasyon', TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM Stations WHERE Id = '00000000-0000-0000-0000-000000000001'::uuid);

-- 3. Alter Cartons table
ALTER TABLE Cartons ADD COLUMN IF NOT EXISTS StockCode TEXT;
ALTER TABLE Cartons ADD COLUMN IF NOT EXISTS StationId UUID REFERENCES Stations(Id) ON DELETE RESTRICT;

-- 4. Migrate Data
UPDATE Cartons c
SET StockCode = o.StockCode,
    StationId = '00000000-0000-0000-0000-000000000001'::uuid
FROM Orders o
WHERE c.OrderId = o.Id AND (c.StockCode IS NULL OR c.StationId IS NULL);

-- 5. Fail-fast duplicate check
DO $$
DECLARE
    v_duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT OrderId, StockCode, StationId
        FROM Cartons
        WHERE Status = 'Open'
        GROUP BY OrderId, StockCode, StationId
        HAVING COUNT(*) > 1
    ) dupes;

    IF v_duplicate_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Aynı Sipariş (OrderId), Stok Kodu (StockCode) ve İstasyon (StationId) için % adet çakışan (Open) koli bulundu. Lütfen önce bu çakışmaları manuel olarak giderin (örn. eski olanları Closed yapın).', v_duplicate_count;
    END IF;
END $$;

-- 6. Indexes & Constraints
DROP INDEX IF EXISTS IX_Cartons_OrderId_Status;
CREATE INDEX IF NOT EXISTS IX_Cartons_OrderId_StationId_Status ON Cartons(OrderId, StationId, Status);

CREATE UNIQUE INDEX IF NOT EXISTS UQ_Cartons_SingleOpenPerStation 
ON Cartons (OrderId, StockCode, StationId) 
WHERE Status = 'Open';

COMMIT;
