using System;
using System.Data;
using System.IO;
using System.Reflection;
using Microsoft.Extensions.Configuration;
using Npgsql;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Infrastructure.Data;

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? throw new ArgumentNullException(nameof(configuration), "DefaultConnection connection string is missing.");
    }

    public IDbConnection CreateConnection()
    {
        var connection = new NpgsqlConnection(_connectionString);
        return connection;
    }

    public void InitializeDatabase()
    {
        using var connection = new NpgsqlConnection(_connectionString);
        connection.Open();

        // 1. Run migrations
        // Locate migration file in application paths
        string migrationPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "Migrations", "001_Initial_Setup.sql");
        
        // Fallback for development run
        if (!File.Exists(migrationPath))
        {
            migrationPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "TrackTrace.Infrastructure", "Data", "Migrations", "001_Initial_Setup.sql");
        }
        if (!File.Exists(migrationPath))
        {
            migrationPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "Migrations", "001_Initial_Setup.sql");
        }

        if (File.Exists(migrationPath))
        {
            string sql = File.ReadAllText(migrationPath);
            using var cmd = new NpgsqlCommand(sql, connection);
            cmd.ExecuteNonQuery();
        }
        else
        {
            // If the physical file isn't found, write a minimal inline version to ensure tables are always created
            using var cmd = new NpgsqlCommand(GetFallbackMigrationSql(), connection);
            cmd.ExecuteNonQuery();
        }

        // Drop unique constraint on OrderNo to allow multiple line items with the same order number
        try
        {
            using var cmd = new NpgsqlCommand("ALTER TABLE Orders DROP CONSTRAINT IF EXISTS orders_orderno_key;", connection);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            Console.WriteLine("Could not drop orders_orderno_key constraint: " + ex.Message);
        }
    }

    private string GetFallbackMigrationSql()
    {
        return @"
        CREATE TABLE IF NOT EXISTS Users (
            Id UUID PRIMARY KEY, Name TEXT NOT NULL, Username TEXT UNIQUE NOT NULL, PasswordHash TEXT NOT NULL, Role TEXT NOT NULL, IsActive BOOLEAN NOT NULL DEFAULT TRUE, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS Orders (
            Id UUID PRIMARY KEY, OrderNo TEXT NOT NULL, CustomerName TEXT NOT NULL, StockCode TEXT, ProductName TEXT, GTIN TEXT NOT NULL, ProductPerCarton INT NOT NULL, CartonPerPallet INT NOT NULL, ExpectedQuantity INT NOT NULL, Description TEXT, Status TEXT NOT NULL, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ImportBatches (
            Id UUID PRIMARY KEY, OrderId UUID NOT NULL REFERENCES Orders(Id) ON DELETE CASCADE, FileName TEXT, TotalRows INT NOT NULL DEFAULT 0, ImportedCount INT NOT NULL DEFAULT 0, DuplicateCount INT NOT NULL DEFAULT 0, InvalidCount INT NOT NULL DEFAULT 0, CreatedBy UUID REFERENCES Users(Id) ON DELETE SET NULL, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ImportErrors (
            Id UUID PRIMARY KEY, ImportBatchId UUID NOT NULL REFERENCES ImportBatches(Id) ON DELETE CASCADE, RowNo INT NOT NULL, RawLine TEXT, ErrorMessage TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS Cartons (
            Id UUID PRIMARY KEY, OrderId UUID NOT NULL REFERENCES Orders(Id) ON DELETE CASCADE, CartonNo TEXT NOT NULL, SSCC TEXT UNIQUE NOT NULL, TargetQuantity INT NOT NULL, ActualQuantity INT NOT NULL DEFAULT 0, Status TEXT NOT NULL, CreatedBy UUID REFERENCES Users(Id) ON DELETE SET NULL, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, ClosedAt TIMESTAMPTZ, PrintedAt TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS Pallets (
            Id UUID PRIMARY KEY, OrderId UUID NOT NULL REFERENCES Orders(Id) ON DELETE CASCADE, PalletNo TEXT NOT NULL, SSCC TEXT UNIQUE NOT NULL, Status TEXT NOT NULL, CreatedBy UUID REFERENCES Users(Id) ON DELETE SET NULL, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, ClosedAt TIMESTAMPTZ, PrintedAt TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS PalletCartons (
            Id UUID PRIMARY KEY, PalletId UUID NOT NULL REFERENCES Pallets(Id) ON DELETE CASCADE, CartonId UUID NOT NULL REFERENCES Cartons(Id) ON DELETE CASCADE, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT UQ_PalletCartons_Carton UNIQUE (CartonId)
        );
        CREATE TABLE IF NOT EXISTS ProductCodes (
            Id UUID PRIMARY KEY, OrderId UUID NOT NULL REFERENCES Orders(Id) ON DELETE CASCADE, ImportBatchId UUID REFERENCES ImportBatches(Id) ON DELETE SET NULL, RawCode TEXT NOT NULL, Gtin TEXT, SerialNo TEXT, CryptoTail TEXT, Status TEXT NOT NULL, CartonId UUID REFERENCES Cartons(Id) ON DELETE SET NULL, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, ScannedAt TIMESTAMPTZ, ScannedBy UUID REFERENCES Users(Id) ON DELETE SET NULL
        );
        ALTER TABLE ProductCodes ADD COLUMN IF NOT EXISTS ImportBatchId UUID REFERENCES ImportBatches(Id) ON DELETE SET NULL;
        CREATE TABLE IF NOT EXISTS PrintJobs (
            Id UUID PRIMARY KEY, LabelType TEXT NOT NULL, EntityId UUID NOT NULL, PrintedBy UUID REFERENCES Users(Id) ON DELETE SET NULL, PrintCount INT NOT NULL DEFAULT 1, Format TEXT NOT NULL, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS AuditLogs (
            Id UUID PRIMARY KEY, UserId UUID REFERENCES Users(Id) ON DELETE SET NULL, EntityName TEXT NOT NULL, EntityId UUID, Action TEXT NOT NULL, OldValue JSONB, NewValue JSONB, CreatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, IpAddress TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_ProductCodes_RawCode ON ProductCodes(RawCode);
        CREATE INDEX IF NOT EXISTS IX_ProductCodes_OrderId_Status ON ProductCodes(OrderId, Status);
        CREATE INDEX IF NOT EXISTS IX_ProductCodes_ImportBatchId ON ProductCodes(ImportBatchId);
        CREATE INDEX IF NOT EXISTS IX_ProductCodes_CartonId ON ProductCodes(CartonId);
        CREATE INDEX IF NOT EXISTS IX_ProductCodes_OrderId_Status_ScannedAt ON ProductCodes(OrderId, Status, ScannedAt DESC);
        CREATE INDEX IF NOT EXISTS IX_Orders_OrderNo ON Orders(OrderNo);
        CREATE INDEX IF NOT EXISTS IX_PalletCartons_PalletId ON PalletCartons(PalletId);
        CREATE INDEX IF NOT EXISTS IX_ImportErrors_ImportBatchId ON ImportErrors(ImportBatchId);
        DROP INDEX IF EXISTS IX_Cartons_SSCC;
        DROP INDEX IF EXISTS IX_Pallets_SSCC;

        CREATE SEQUENCE IF NOT EXISTS carton_no_seq START WITH 1;
        CREATE SEQUENCE IF NOT EXISTS pallet_no_seq START WITH 1;
        CREATE SEQUENCE IF NOT EXISTS sscc_seq START WITH 1;

        SELECT setval('carton_no_seq', COALESCE((SELECT MAX(right(CartonNo, 4)::integer) FROM Cartons WHERE CartonNo ~ '-[0-9]{4}$'), 0) + 1, false);
        SELECT setval('pallet_no_seq', COALESCE((SELECT MAX(right(PalletNo, 4)::integer) FROM Pallets WHERE PalletNo ~ '-[0-9]{4}$'), 0) + 1, false);
        SELECT setval('sscc_seq', COALESCE((
            SELECT MAX(val) FROM (
                SELECT substring(SSCC from 11 for 7)::integer AS val FROM Cartons WHERE SSCC ~ '^[0-9]{18}$'
                UNION ALL
                SELECT substring(SSCC from 11 for 7)::integer AS val FROM Pallets WHERE SSCC ~ '^[0-9]{18}$'
            ) t
        ), 0) + 1, false);

        CREATE UNIQUE INDEX IF NOT EXISTS UQ_Cartons_CartonNo ON Cartons(CartonNo);
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_Pallets_PalletNo ON Pallets(PalletNo);
        ";
    }
}
