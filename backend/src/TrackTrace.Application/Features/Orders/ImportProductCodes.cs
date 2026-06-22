using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using Npgsql;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Orders;

public record ImportProductCodesCommand(Guid OrderId, string FileName, Stream FileStream, string Profile = "Auto") : IRequest<ImportResultDto>;

public class ImportProductCodesCommandHandler : IRequestHandler<ImportProductCodesCommand, ImportResultDto>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;

    public ImportProductCodesCommandHandler(
        IDbConnectionFactory dbConnectionFactory,
        ICurrentUserService currentUserService,
        IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
    }

    public async Task<ImportResultDto> Handle(ImportProductCodesCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            connection.Open();
        }

        // 1. Check if Order exists and can accept code uploads
        var order = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Status, GTIN FROM Orders WHERE Id = @Id", new { Id = request.OrderId });
        if (order == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }
        if (order.status != OrderStatus.Draft.ToString() && order.status != OrderStatus.Cancelled.ToString())
        {
            throw new InvalidOperationException("Yalnızca taslak veya iptal durumundaki siparişlere kod yüklenebilir.");
        }

        string orderGtin = order.gtin;

        var batchId = Guid.NewGuid();
        var currentUserId = _currentUserService.UserId;
        
        var lines = new List<string>();
        string extension = Path.GetExtension(request.FileName).ToLowerInvariant();

        if (extension == ".xlsx")
        {
            using var workbook = new ClosedXML.Excel.XLWorkbook(request.FileStream);
            var worksheet = workbook.Worksheets.FirstOrDefault();
            if (worksheet != null && worksheet.RangeUsed() != null)
            {
                var rows = worksheet.RangeUsed().RowsUsed();
                foreach (var row in rows)
                {
                    // Skip completely empty rows
                    if (row.CellsUsed().Count() == 0) continue;

                    // Header row check: if any cell in the row contains typical header words, skip the row
                    bool isHeader = false;
                    foreach (var cell in row.CellsUsed())
                    {
                        string cellVal = cell.GetFormattedString().Trim().ToLowerInvariant();
                        if (cellVal == "barkod" || cellVal == "barcode" || cellVal == "kod" || cellVal == "code" || 
                            cellVal == "gtin" || cellVal == "serial" || cellVal == "seri" || cellVal == "sscc" || 
                            cellVal == "value" || cellVal == "değer")
                        {
                            isHeader = true;
                            break;
                        }
                    }
                    if (isHeader) continue;

                    string? candidate = null;
                    foreach (var cell in row.CellsUsed())
                    {
                        string cellVal = "";
                        if (cell.DataType == ClosedXML.Excel.XLDataType.Number)
                        {
                            // Avoid scientific notation formatting for numeric barcodes
                            cellVal = cell.Value.GetNumber().ToString("F0", System.Globalization.CultureInfo.InvariantCulture).Trim();
                        }
                        else
                        {
                            cellVal = cell.GetFormattedString().Trim();
                        }

                        if (!string.IsNullOrWhiteSpace(cellVal))
                        {
                            if (cellVal.StartsWith("01") || cellVal.StartsWith("(01)") || cellVal.StartsWith("\\F") || cellVal.StartsWith("\u001d"))
                            {
                                candidate = cellVal;
                                break; // High-probability barcode found, stop scanning other cells in this row
                            }
                            if (candidate == null)
                            {
                                candidate = cellVal;
                            }
                        }
                    }
                    if (!string.IsNullOrEmpty(candidate))
                    {
                        lines.Add(candidate);
                    }
                }
            }
        }
        else if (extension == ".csv")
        {
            using var reader = new StreamReader(request.FileStream, Encoding.UTF8);
            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrWhiteSpace(line)) continue;

                string raw = line.Trim();
                if (raw.Contains(",") || raw.Contains(";"))
                {
                    var parts = raw.Split(new[] { ',', ';' });
                    string? candidate = null;
                    foreach (var part in parts)
                    {
                        string p = part.Trim();
                        if (p.StartsWith("01") || p.StartsWith("(01)") || p.StartsWith("\\F") || p.StartsWith("\u001d"))
                        {
                            candidate = p;
                            break;
                        }
                        if (candidate == null && !string.IsNullOrWhiteSpace(p))
                        {
                            candidate = p;
                        }
                    }
                    if (!string.IsNullOrEmpty(candidate))
                        lines.Add(candidate);
                }
                else
                {
                    lines.Add(raw);
                }
            }
        }
        else
        {
            using var reader = new StreamReader(request.FileStream, Encoding.UTF8);
            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (!string.IsNullOrWhiteSpace(line))
                {
                    lines.Add(line.Trim());
                }
            }
        }

        int totalRows = lines.Count;
        int importedCount = 0;
        int duplicateCount = 0;
        int invalidCount = 0;

        var errors = new List<ImportErrorDto>();
        var validCodesToInsert = new List<(Guid Id, string RawCode, string? Gtin, string? SerialNo, string? CryptoTail)>();
        var seenRawCodesInFile = new HashSet<string>();

        // 2. Parse and Validate Codes in Memory
        for (int i = 0; i < lines.Count; i++)
        {
            int rowNo = i + 1;
            string raw = lines[i];

            if (string.IsNullOrWhiteSpace(raw))
            {
                invalidCount++;
                errors.Add(new ImportErrorDto(rowNo, raw, "Satır içeriği boş."));
                continue;
            }

            var parsed = Gs1AutoHelper.NormalizeForEncoding(raw, request.Profile);
            if (!parsed.Success)
            {
                invalidCount++;
                errors.Add(new ImportErrorDto(rowNo, raw, parsed.ErrorMessage ?? "Barkod formatı çözümlenemedi."));
                continue;
            }

            if (seenRawCodesInFile.Contains(parsed.Normalized))
            {
                duplicateCount++;
                errors.Add(new ImportErrorDto(rowNo, raw, "Dosya içinde mükerrer kod."));
                continue;
            }

            seenRawCodesInFile.Add(parsed.Normalized);
            validCodesToInsert.Add((Guid.NewGuid(), parsed.Normalized, parsed.Gtin, parsed.SerialNo, parsed.CryptoTail));
        }

        await connection.ExecuteAsync(@"
            INSERT INTO ImportBatches (Id, OrderId, FileName, TotalRows, ImportedCount, DuplicateCount, InvalidCount, CreatedBy, CreatedAt)
            VALUES (@Id, @OrderId, @FileName, @TotalRows, 0, 0, @InvalidCount, @CreatedBy, @CreatedAt)",
            new
            {
                Id = batchId,
                OrderId = request.OrderId,
                FileName = request.FileName,
                TotalRows = totalRows,
                InvalidCount = invalidCount,
                CreatedBy = currentUserId,
                CreatedAt = DateTime.UtcNow
            });

        // 3. Batch check duplicates against DB
        if (validCodesToInsert.Count > 0)
        {
            // For large files, checking one-by-one is slow.
            // We can query existing rawcodes in batches of 10,000 or write all and catch database unique violations,
            // or select existing from DB. Since RawCode is unique, we will do a fast check by picking chunks of code and query DB.
            var uniqueValidCodes = new List<(Guid Id, string RawCode, string? Gtin, string? SerialNo, string? CryptoTail)>();
            const int checkBatchSize = 5000;
            
            for (int offset = 0; offset < validCodesToInsert.Count; offset += checkBatchSize)
            {
                var chunk = validCodesToInsert.Skip(offset).Take(checkBatchSize).ToList();
                var rawCodesToCheck = chunk.Select(c => c.RawCode).ToList();

                var existingCodes = (await connection.QueryAsync<string>(
                    "SELECT RawCode FROM ProductCodes WHERE RawCode = ANY(@Codes)",
                    new { Codes = rawCodesToCheck })).ToHashSet();

                foreach (var code in chunk)
                {
                    if (existingCodes.Contains(code.RawCode))
                    {
                        duplicateCount++;
                        errors.Add(new ImportErrorDto(0, code.RawCode, "Veritabanında bu barkod zaten mevcut."));
                    }
                    else
                    {
                        uniqueValidCodes.Add(code);
                    }
                }
            }

            // 4. PostgreSQL Binary Copy Bulk Insert (Extremely Fast!)
            if (uniqueValidCodes.Count > 0)
            {
                using var transaction = connection.BeginTransaction();
                try
                {
                    using (var writer = connection.BeginBinaryImport(
                        "COPY ProductCodes (Id, OrderId, ImportBatchId, RawCode, Gtin, SerialNo, CryptoTail, Status, CreatedAt) FROM STDIN (FORMAT BINARY)"))
                    {
                        foreach (var code in uniqueValidCodes)
                        {
                            writer.StartRow();
                            writer.Write(code.Id, NpgsqlTypes.NpgsqlDbType.Uuid);
                            writer.Write(request.OrderId, NpgsqlTypes.NpgsqlDbType.Uuid);
                            writer.Write(batchId, NpgsqlTypes.NpgsqlDbType.Uuid);
                            writer.Write(code.RawCode, NpgsqlTypes.NpgsqlDbType.Text);
                            writer.Write(code.Gtin ?? (object)DBNull.Value, NpgsqlTypes.NpgsqlDbType.Text);
                            writer.Write(code.SerialNo ?? (object)DBNull.Value, NpgsqlTypes.NpgsqlDbType.Text);
                            writer.Write(code.CryptoTail ?? (object)DBNull.Value, NpgsqlTypes.NpgsqlDbType.Text);
                            writer.Write(ProductCodeStatus.Uploaded.ToString(), NpgsqlTypes.NpgsqlDbType.Text);
                            writer.Write(DateTime.UtcNow, NpgsqlTypes.NpgsqlDbType.TimestampTz);
                        }
                        writer.Complete();
                    }

                    transaction.Commit();
                    importedCount = uniqueValidCodes.Count;
                }
                catch (Exception ex)
                {
                    transaction.Rollback();
                    throw new InvalidOperationException("Barkodlar kaydedilirken veritabanı hatası oluştu: " + ex.Message, ex);
                }
            }
        }

        // 5. Save Import Batch summary and Errors
        using (var transaction = connection.BeginTransaction())
        {
            try
            {
                await connection.ExecuteAsync(@"
                    UPDATE ImportBatches
                    SET ImportedCount = @ImportedCount,
                        DuplicateCount = @DuplicateCount,
                        InvalidCount = @InvalidCount
                    WHERE Id = @Id",
                    new
                    {
                        Id = batchId,
                        ImportedCount = importedCount,
                        DuplicateCount = duplicateCount,
                        InvalidCount = invalidCount
                    }, transaction);

                if (errors.Count > 0)
                {
                    // Insert errors in batches
                    const string errSql = @"
                        INSERT INTO ImportErrors (Id, ImportBatchId, RowNo, RawLine, ErrorMessage)
                        VALUES (@Id, @ImportBatchId, @RowNo, @RawLine, @ErrorMessage)";

                    var errParams = errors.Select((e, idx) => new
                    {
                        Id = Guid.NewGuid(),
                        ImportBatchId = batchId,
                        RowNo = e.RowNo == 0 ? idx + 1 : e.RowNo,
                        RawLine = e.RawLine,
                        ErrorMessage = e.ErrorMessage
                    }).ToList();

                    await connection.ExecuteAsync(errSql, errParams, transaction);
                }

                transaction.Commit();
            }
            catch (Exception)
            {
                transaction.Rollback();
                // We won't crash the whole flow if logging batch details fails, but in production, we should handle it.
                throw;
            }
        }

        await _auditLogService.LogAsync("ImportBatches", batchId, "Import", null, new
        {
            OrderId = request.OrderId,
            TotalRows = totalRows,
            ImportedCount = importedCount
        });

        return new ImportResultDto(batchId, totalRows, importedCount, duplicateCount, invalidCount, errors.Take(100).ToList());
    }


}
