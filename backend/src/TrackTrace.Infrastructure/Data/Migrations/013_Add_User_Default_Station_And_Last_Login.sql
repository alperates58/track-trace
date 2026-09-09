CREATE TABLE IF NOT EXISTS DataMigrations (
    Name TEXT PRIMARY KEY,
    AppliedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM DataMigrations
        WHERE Name = '013_Add_User_Default_Station_And_Last_Login'
    ) THEN
        ALTER TABLE Users ADD COLUMN IF NOT EXISTS DefaultStationId UUID NULL REFERENCES Stations(Id) ON DELETE SET NULL;
        ALTER TABLE Users ADD COLUMN IF NOT EXISTS LastLoginAt TIMESTAMPTZ NULL;

        INSERT INTO DataMigrations (Name, AppliedAt)
        VALUES ('013_Add_User_Default_Station_And_Last_Login', CURRENT_TIMESTAMP);
    END IF;
END $$;
