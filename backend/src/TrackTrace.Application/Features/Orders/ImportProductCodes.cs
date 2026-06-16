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

public record ImportProductCodesCommand(Guid OrderId, string FileName, Stream FileStream) : IRequest<ImportResultDto>;

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

        // 1. Check if Order exists and is in Draft state
        var order = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Status, GTIN FROM Orders WHERE Id = @Id", new { Id = request.OrderId });
        if (order == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }
        if (order.status != OrderStatus.Draft.ToString())
        {
            throw new InvalidOperationException("Yalnızca taslak durumundaki siparişlere kod yüklenebilir.");
        }

        string orderGtin = order.gtin;

        var batchId = Guid.NewGuid();
        var currentUserId = _currentUserService.UserId;
        
        var lines = new List<string>();
        using (var reader = new StreamReader(request.FileStream, Encoding.UTF8))
        {
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

            if (seenRawCodesInFile.Contains(raw))
            {
                duplicateCount++;
                errors.Add(new ImportErrorDto(rowNo, raw, "Dosya içinde mükerrer kod."));
                continue;
            }

            // Parse GS1 DataMatrix
            var (gtin, serial, crypto, success, parseError) = ParseGs1DataMatrix(raw);
            if (!success)
            {
                invalidCount++;
                errors.Add(new ImportErrorDto(rowNo, raw, parseError ?? "Barkod formatı çözümlenemedi."));
                continue;
            }

            // Optional: GTIN check
            if (!string.IsNullOrEmpty(gtin) && gtin != orderGtin)
            {
                invalidCount++;
                errors.Add(new ImportErrorDto(rowNo, raw, $"GTIN uyuşmazlığı. Sipariş GTIN: {orderGtin}, Barkod GTIN: {gtin}"));
                continue;
            }

            seenRawCodesInFile.Add(raw);
            validCodesToInsert.Add((Guid.NewGuid(), raw, gtin, serial, crypto));
        }

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
                        "COPY ProductCodes (Id, OrderId, RawCode, Gtin, SerialNo, CryptoTail, Status, CreatedAt) FROM STDIN (FORMAT BINARY)"))
                    {
                        foreach (var code in uniqueValidCodes)
                        {
                            writer.StartRow();
                            writer.Write(code.Id, NpgsqlTypes.NpgsqlDbType.Uuid);
                            writer.Write(request.OrderId, NpgsqlTypes.NpgsqlDbType.Uuid);
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

        // 5. Save Import Batch and Errors
        using (var transaction = connection.BeginTransaction())
        {
            try
            {
                await connection.ExecuteAsync(@"
                    INSERT INTO ImportBatches (Id, OrderId, FileName, TotalRows, ImportedCount, DuplicateCount, InvalidCount, CreatedBy, CreatedAt)
                    VALUES (@Id, @OrderId, @FileName, @TotalRows, @ImportedCount, @DuplicateCount, @InvalidCount, @CreatedBy, @CreatedAt)",
                    new
                    {
                        Id = batchId,
                        OrderId = request.OrderId,
                        FileName = request.FileName,
                        TotalRows = totalRows,
                        ImportedCount = importedCount,
                        DuplicateCount = duplicateCount,
                        InvalidCount = invalidCount,
                        CreatedBy = currentUserId,
                        CreatedAt = DateTime.UtcNow
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

    private (string? Gtin, string? SerialNo, string? CryptoTail, bool Success, string? Error) ParseGs1DataMatrix(string raw)
    {
        // Sample: 0104630477370359215-zOwm GS 93NdhB
        // GS is Group Separator ASCII 29. Often represented as <GS>, \u001d, or spaces.
        // Clean parentheses like (01)04630477370359(21)5-zOwm
        string clean = raw.Replace("(", "").Replace(")", "");
        
        string? gtin = null;
        string? serial = null;
        string? crypto = null;

        // Try AI 01 first (GTIN is 14 digits)
        if (clean.StartsWith("01") && clean.Length >= 16)
        {
            gtin = clean.Substring(2, 14);
            string remainder = clean.Substring(16);

            // Look for AI 21
            if (remainder.StartsWith("21"))
            {
                remainder = remainder.Substring(2);
                
                // Serial ends at GS separator or space or end of string.
                // Russian Kozmetik: Serial is usually 13 characters. Let's find first separator.
                int separatorIdx = remainder.IndexOfAny(new[] { ' ', '\u001d', '\u001d' });
                if (separatorIdx != -1)
                {
                    serial = remainder.Substring(0, separatorIdx);
                    crypto = remainder.Substring(separatorIdx).TrimStart(' ', '\u001d');
                }
                else
                {
                    // No separator, if length is greater than 13, serial might be 13 and rest is crypto
                    if (remainder.Length > 13)
                    {
                        serial = remainder.Substring(0, 13);
                        crypto = remainder.Substring(13);
                    }
                    else
                    {
                        serial = remainder;
                    }
                }
            }
            else
            {
                serial = remainder;
            }
        }
        else
        {
            // Standard parse failed, search using regex
            var gtinMatch = Regex.Match(raw, @"01(\d{14})");
            var serialMatch = Regex.Match(raw, @"21([A-Za-z0-9\-\_]{13})");

            if (gtinMatch.Success)
            {
                gtin = gtinMatch.Groups[1].Value;
            }
            if (serialMatch.Success)
            {
                serial = serialMatch.Groups[1].Value;
            }

            crypto = raw; // default fallback
        }

        // Check if GTIN is numeric
        if (!string.IsNullOrEmpty(gtin) && !gtin.All(char.IsDigit))
        {
            return (null, null, null, false, "GTIN sayısal değerlerden oluşmalıdır.");
        }

        return (gtin, serial, crypto, true, null);
    }
}
