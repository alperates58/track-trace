CREATE TABLE IF NOT EXISTS DataMigrations (
    Name TEXT PRIMARY KEY,
    AppliedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM DataMigrations
        WHERE Name = '011_Cleanup_Noncritical_Audit_Logs'
    ) THEN
        DELETE FROM AuditLogs
        WHERE NOT (
            (EntityName = 'Users' AND Action IN ('Create', 'Update', 'ToggleActive'))
            OR (EntityName = 'Stations' AND Action IN ('Create', 'Update'))
            OR (EntityName = 'Orders' AND Action IN (
                'Create', 'Update', 'Activate', 'Complete', 'Cancel', 'Delete',
                'ClearProductCodes', 'PrePrintCartonsGenerated'
            ))
            OR (EntityName = 'OrderGroups' AND Action = 'DeleteGroup')
            OR (EntityName = 'ImportBatches' AND Action IN ('Import', 'DeleteBatch'))
            OR (EntityName = 'CartonBatch' AND Action = 'MarkPrinted')
            OR (EntityName = 'Cartons' AND Action IN (
                'Close', 'Decompose', 'EmptyContents', 'RemoveProduct',
                'TransferStation', 'TransferUser', 'Voided', 'Reprint', 'PrePrintedOpened'
            ))
            OR (EntityName = 'Pallets' AND Action IN ('Close', 'TransferCarton', 'Delete'))
            OR (EntityName = 'ProductCodes' AND Action = 'DoubleScanAttempt')
            OR (EntityName = 'Shipments' AND Action IN (
                'RemoveItem', 'Complete', 'ReverseShipment', 'Cancel', 'DeleteCancelled'
            ))
        );

        INSERT INTO DataMigrations (Name)
        VALUES ('011_Cleanup_Noncritical_Audit_Logs')
        ON CONFLICT (Name) DO NOTHING;
    END IF;
END $$;
