CREATE TABLE IF NOT EXISTS DataMigrations (
    Name TEXT PRIMARY KEY,
    AppliedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM DataMigrations
        WHERE Name = '012_Add_Carton_Edit_To_Operator'
    ) THEN
        INSERT INTO RolePermissions (Role, PermissionKey)
        VALUES ('Operator', 'cartons.edit')
        ON CONFLICT (Role, PermissionKey) DO NOTHING;

        INSERT INTO DataMigrations (Name, AppliedAt)
        VALUES ('012_Add_Carton_Edit_To_Operator', CURRENT_TIMESTAMP);
    END IF;
END $$;
