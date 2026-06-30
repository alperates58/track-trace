using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Npgsql;
using System.Data;
using TrackTrace.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace TrackTrace.Application.Features.Reports;

public record ExportCsvZipCommand(Guid JobId, string OrderNo, string? StockCode, string FilePath) : IRequest;

public class ExportCsvZipCommandHandler : IRequestHandler<ExportCsvZipCommand>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ILogger<ExportCsvZipCommandHandler> _logger;

    public ExportCsvZipCommandHandler(IDbConnectionFactory dbConnectionFactory, ILogger<ExportCsvZipCommandHandler> logger)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _logger = logger;
    }

    public async Task Handle(ExportCsvZipCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection() as NpgsqlConnection;
        if (connection == null)
            throw new InvalidOperationException("Connection must be an NpgsqlConnection.");
            
        await connection.OpenAsync(cancellationToken);

        // Fetch OrderId
        using var orderCmd = new NpgsqlCommand("SELECT Id FROM Orders WHERE OrderNo = @OrderNo LIMIT 1", connection);
        orderCmd.Parameters.AddWithValue("OrderNo", request.OrderNo);
        var orderIdObj = await orderCmd.ExecuteScalarAsync(cancellationToken);
        if (orderIdObj == null)
            throw new Exception("Siparis bulunamadi.");
            
        Guid orderId = (Guid)orderIdObj;

        int updateFrequency = 50000;
        int currentCount = 0;

        using var fileStream = new FileStream(request.FilePath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.Asynchronous);
        using var archive = new ZipArchive(fileStream, ZipArchiveMode.Create, true);

        async Task RunQueryToCsv(string entryName, string sql, Action<NpgsqlCommand> bindParams, string[] headers)
        {
            var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
            using var entryStream = entry.Open();
            // UTF-8 BOM for Excel TR support
            await entryStream.WriteAsync(new byte[] { 0xEF, 0xBB, 0xBF }, 0, 3, cancellationToken);
            using var writer = new StreamWriter(entryStream, new UTF8Encoding(false), 8192, leaveOpen: true);

            await writer.WriteLineAsync(string.Join(";", headers));

            using var cmd = new NpgsqlCommand(sql, connection);
            bindParams(cmd);
            using var reader = await cmd.ExecuteReaderAsync(CommandBehavior.SequentialAccess, cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                var row = new string[reader.FieldCount];
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    if (reader.IsDBNull(i))
                    {
                        row[i] = "";
                        continue;
                    }
                    var val = reader.GetValue(i).ToString() ?? "";
                    if (val.Contains(";") || val.Contains("\"") || val.Contains("\n") || val.Contains("\r"))
                    {
                        val = "\"" + val.Replace("\"", "\"\"") + "\"";
                    }
                    row[i] = val;
                }

                await writer.WriteLineAsync(string.Join(";", row));

                currentCount++;
                if (currentCount % updateFrequency == 0)
                {
                    // Fire and forget progress update in separate connection to avoid blocking the streaming connection
                    _ = Task.Run(async () => {
                        try
                        {
                            using var progressConn = _dbConnectionFactory.CreateConnection();
                            using var progressCmd = progressConn.CreateCommand();
                            progressCmd.CommandText = "UPDATE ExportJobs SET Progress = @Prog WHERE Id = @Id";
                            
                            var p1 = progressCmd.CreateParameter();
                            p1.ParameterName = "Prog";
                            p1.Value = Math.Min(90, 10 + (currentCount / updateFrequency));
                            progressCmd.Parameters.Add(p1);

                            var p2 = progressCmd.CreateParameter();
                            p2.ParameterName = "Id";
                            p2.Value = request.JobId;
                            progressCmd.Parameters.Add(p2);

                            progressConn.Open();
                            progressCmd.ExecuteNonQuery();
                        }
                        catch { /* ignore progress update failure */ }
                    });
                }
            }
        }

        // 1. Summary
        string summarySql = @"
            SELECT 
                o.OrderNo, MAX(o.CustomerName), COUNT(DISTINCT o.StockCode),
                SUM(o.ExpectedQuantity), COALESCE(SUM(pc.UsedCount), 0),
                COALESCE(SUM(pc.UploadedCount), 0), COALESCE(SUM(c.CartonCount), 0),
                COALESCE(SUM(p.PalletCount), 0)
            FROM Orders o
            LEFT JOIN (
                SELECT OrderId, COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount, COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount
                FROM ProductCodes GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId) c ON o.Id = c.OrderId
            LEFT JOIN (SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId) p ON o.Id = p.OrderId
            WHERE o.Id = @OrderId GROUP BY o.OrderNo";
        await RunQueryToCsv("summary.csv", summarySql, cmd => cmd.Parameters.AddWithValue("OrderId", orderId), 
            new[] { "OrderNo", "CustomerName", "TotalStockCodes", "ExpectedQuantity", "UsedQuantity", "MissingQuantity", "TotalCartons", "TotalPallets" });

        // 2. Stock Codes
        string stockCodesSql = @"
            SELECT 
                o.StockCode, MAX(o.ProductName), SUM(o.ExpectedQuantity), COALESCE(SUM(pc.UsedCount), 0),
                COALESCE(SUM(pc.UploadedCount), 0), COALESCE(SUM(c.CartonCount), 0), COALESCE(SUM(p.PalletCount), 0)
            FROM Orders o
            LEFT JOIN (
                SELECT OrderId, COUNT(CASE WHEN Status != 'Uploaded' THEN 1 END) as UsedCount, COUNT(CASE WHEN Status = 'Uploaded' THEN 1 END) as UploadedCount
                FROM ProductCodes GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN (SELECT OrderId, COUNT(*) as CartonCount FROM Cartons GROUP BY OrderId) c ON o.Id = c.OrderId
            LEFT JOIN (SELECT OrderId, COUNT(*) as PalletCount FROM Pallets GROUP BY OrderId) p ON o.Id = p.OrderId
            WHERE o.Id = @OrderId";
        if (!string.IsNullOrEmpty(request.StockCode)) stockCodesSql += " AND o.StockCode = @StockCode";
        stockCodesSql += " GROUP BY o.StockCode";
        
        await RunQueryToCsv("stock_codes.csv", stockCodesSql, cmd => {
            cmd.Parameters.AddWithValue("OrderId", orderId);
            if (!string.IsNullOrEmpty(request.StockCode)) cmd.Parameters.AddWithValue("StockCode", request.StockCode);
        }, new[] { "StockCode", "ProductName", "ExpectedQuantity", "UsedQuantity", "MissingQuantity", "CartonCount", "PalletCount" });

        // 3. Used Codes (Large)
        string usedCodesSql = @"
            SELECT pc.RawCode, pc.Gtin, pc.SerialNo, c.CartonNo, p.PalletNo, u.Name, pc.ScannedAt, pc.Status
            FROM ProductCodes pc
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            WHERE pc.OrderId = @OrderId AND pc.Status != 'Uploaded'";
        await RunQueryToCsv("used_codes.csv", usedCodesSql, cmd => cmd.Parameters.AddWithValue("OrderId", orderId),
            new[] { "QR_RawCode", "GTIN", "SerialNo", "CartonNo", "PalletNo", "ScannedBy", "ScannedAt", "Status" });

        // 4. Missing Codes (Large)
        string missingCodesSql = @"SELECT RawCode, Gtin, SerialNo, Status FROM ProductCodes WHERE OrderId = @OrderId AND Status = 'Uploaded'";
        await RunQueryToCsv("missing_codes.csv", missingCodesSql, cmd => cmd.Parameters.AddWithValue("OrderId", orderId),
            new[] { "QR_RawCode", "GTIN", "SerialNo", "Status" });

        // 5. Carton Distribution
        string cartonDistSql = @"
            SELECT c.CartonNo, c.SSCC, pc.RawCode, pc.SerialNo, p.PalletNo, pc.ScannedAt
            FROM ProductCodes pc
            INNER JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE pc.OrderId = @OrderId AND pc.Status != 'Uploaded'";
        await RunQueryToCsv("carton_distribution.csv", cartonDistSql, cmd => cmd.Parameters.AddWithValue("OrderId", orderId),
            new[] { "CartonNo", "SSCC", "QR_RawCode", "SerialNo", "PalletNo", "ScannedAt" });

        // 6. Pallet Distribution
        string palletDistSql = @"
            SELECT p.PalletNo, c.CartonNo, c.SSCC, c.ActualQuantity
            FROM Pallets p
            INNER JOIN PalletCartons pcart ON p.Id = pcart.PalletId
            INNER JOIN Cartons c ON pcart.CartonId = c.Id
            WHERE p.OrderId = @OrderId";
        await RunQueryToCsv("pallet_distribution.csv", palletDistSql, cmd => cmd.Parameters.AddWithValue("OrderId", orderId),
            new[] { "PalletNo", "CartonNo", "SSCC", "QrCount" });
    }
}
