using System;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using FluentValidation;
using MediatR;
using Npgsql;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Scan;

public record ScanProductCommand(ScanRequest Request) : IRequest<ScanResponse>;

public class ScanProductCommandValidator : AbstractValidator<ScanProductCommand>
{
    public ScanProductCommandValidator()
    {
        RuleFor(x => x.Request.OrderId).NotEmpty().WithMessage("Sipariş seçilmelidir.");
        RuleFor(x => x.Request.RawCode).NotEmpty().WithMessage("Barkod okutulmalıdır.");
        RuleFor(x => x.Request.StationId).NotEmpty().WithMessage("Lütfen aktif bir istasyon seçin.");
    }
}

public class ScanProductCommandHandler : IRequestHandler<ScanProductCommand, ScanResponse>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;

    public ScanProductCommandHandler(
        IDbConnectionFactory dbConnectionFactory,
        ICurrentUserService currentUserService,
        IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
    }

    public async Task<ScanResponse> Handle(ScanProductCommand request, CancellationToken cancellationToken)
    {
        var req = request.Request;
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != ConnectionState.Open)
        {
            connection.Open();
        }

        using var transaction = connection.BeginTransaction();
        try
        {
            // Normalize the scanned barcode first to ensure match with normalized DB codes
            var parsed = Gs1AutoHelper.NormalizeForEncoding(req.RawCode);
            string searchCode = parsed.Success ? parsed.Normalized : req.RawCode;

            // 1. SELECT PRODUCT CODE WITH ROW LOCKING FOR UPDATE (Prevents double scan race conditions)
            const string pcSql = "SELECT * FROM ProductCodes WHERE RawCode = @RawCode FOR UPDATE";
            var pc = await connection.QueryFirstOrDefaultAsync<dynamic>(pcSql, new { RawCode = searchCode }, transaction);
            
            if (pc == null && searchCode != req.RawCode)
            {
                // Fallback 1: Try exact raw scanned code
                pc = await connection.QueryFirstOrDefaultAsync<dynamic>(pcSql, new { RawCode = req.RawCode }, transaction);
            }

            if (pc == null)
            {
                // Fallback 2: Compare codes by stripping GS (ASCII 29) characters to bypass scanner config/profile mismatches
                const string cleanPcSql = @"
                    SELECT * FROM ProductCodes 
                    WHERE REPLACE(RawCode, CHR(29), '') = @CleanCode 
                    FOR UPDATE";
                string cleanSearchCode = req.RawCode.Replace(((char)29).ToString(), "");
                pc = await connection.QueryFirstOrDefaultAsync<dynamic>(cleanPcSql, new { CleanCode = cleanSearchCode }, transaction);
            }
            
            if (pc == null)
            {
                return new ScanResponse(false, "Sistemde kayıtlı olmayan ürün barkodu!", req.RawCode, null, null, null, null, 0, 0, "Error");
            }

            string pcStatusStr = pc.status;
            if (pcStatusStr != ProductCodeStatus.Uploaded.ToString())
            {
                await _auditLogService.LogAsync("ProductCodes", (Guid)pc.id, "DoubleScanAttempt", null, new { RawCode = req.RawCode });
                return new ScanResponse(false, "Bu ürün barkodu daha önce okutulmuş!", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Warning");
            }

            Guid pcOrderId = pc.orderid;
            if (pcOrderId != req.OrderId)
            {
                return new ScanResponse(false, "Barkod bu siparişe ait değil!", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
            }

            // 2. CHECK ORDER STATUS
            const string orderSql = "SELECT * FROM Orders WHERE Id = @Id";
            var order = await connection.QueryFirstOrDefaultAsync<dynamic>(orderSql, new { Id = req.OrderId }, transaction);
            if (order == null)
            {
                return new ScanResponse(false, "Sipariş bulunamadı.", req.RawCode, null, null, null, null, 0, 0, "Error");
            }

            string orderStatusStr = order.status;
            if (orderStatusStr != OrderStatus.Active.ToString())
            {
                return new ScanResponse(false, "Sipariş aktif durumda değil!", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
            }

            int productPerCarton = order.productpercarton;
            string orderNo = order.orderno;
            string? orderStockCode = order.stockcode;

            // 3. SELECT OPEN/FILLING CARTON WITH LOCK
            dynamic carton = null;
            if (req.Mode == "PrePrinted")
            {
                if (req.ActiveCartonId == null)
                {
                    return new ScanResponse(false, "Aktif koli bulunamadı. Lütfen önce koli barkodunu okutun.", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
                }

                const string fillingCartonSql = @"
                    SELECT * FROM Cartons 
                    WHERE Id = @ActiveCartonId
                    FOR UPDATE";
                carton = await connection.QueryFirstOrDefaultAsync<dynamic>(fillingCartonSql, new { ActiveCartonId = req.ActiveCartonId }, transaction);
                
                if (carton == null)
                {
                    return new ScanResponse(false, "Koli bulunamadı.", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
                }
                
                if (carton.status != CartonStatus.Filling.ToString())
                {
                    return new ScanResponse(false, "Koli doldurulabilir durumda değil.", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
                }

                if ((Guid?)carton.assigneduserid != _currentUserService.UserId || (Guid?)carton.openedby != _currentUserService.UserId)
                {
                    return new ScanResponse(false, "Bu koli başka bir kullanıcı tarafından açılmış.", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
                }

                if ((Guid?)carton.stationid != req.StationId)
                {
                    return new ScanResponse(false, "Aktif koli farklı bir istasyonda okutuluyor. Lütfen doğru istasyonu seçin.", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
                }
                
                if ((Guid)carton.orderid != req.OrderId)
                {
                     return new ScanResponse(false, "Okutulan koli seçili siparişe ait değil!", req.RawCode, pc.gtin, pc.serialno, null, null, 0, 0, "Error");
                }
            }
            else
            {
                const string openCartonSql = @"
                    SELECT * FROM Cartons 
                    WHERE OrderId = @OrderId AND StationId = @StationId AND Status = @StatusOpen 
                    ORDER BY CreatedAt DESC 
                    LIMIT 1 FOR UPDATE";
                carton = await connection.QueryFirstOrDefaultAsync<dynamic>(openCartonSql, new { OrderId = req.OrderId, StationId = req.StationId, StatusOpen = CartonStatus.Open.ToString() }, transaction);
            }

            Guid cartonId;
            string cartonNo;
            string sscc;
            int actualQty;
            bool newlyCreated = false;

            if (carton == null && req.Mode != "PrePrinted")
            {
                // Create a new Carton
                cartonId = Guid.NewGuid();
                
                // Generate CartonNo sequence
                int cartonSequence = await connection.ExecuteScalarAsync<int>(
                    "SELECT nextval('carton_no_seq')", null, transaction);
                cartonNo = $"K-{orderNo}-{cartonSequence:D4}";

                // Generate SSCC-18 (Serial Shipping Container Code)
                sscc = await GenerateSSCC18Async(connection, transaction);
                actualQty = 0;

                const string insertCartonSql = @"
                    INSERT INTO Cartons (Id, OrderId, StockCode, StationId, CartonNo, SSCC, TargetQuantity, ActualQuantity, Status, CreatedBy, CreatedAt)
                    VALUES (@Id, @OrderId, @StockCode, @StationId, @CartonNo, @SSCC, @TargetQuantity, @ActualQuantity, @Status, @CreatedBy, @CreatedAt)";

                await connection.ExecuteAsync(insertCartonSql, new
                {
                    Id = cartonId,
                    OrderId = req.OrderId,
                    StockCode = orderStockCode,
                    StationId = req.StationId,
                    CartonNo = cartonNo,
                    SSCC = sscc,
                    TargetQuantity = productPerCarton,
                    ActualQuantity = 0,
                    Status = CartonStatus.Open.ToString(),
                    CreatedBy = _currentUserService.UserId,
                    CreatedAt = DateTime.UtcNow
                }, transaction);
            }
            else
            {
                cartonId = carton.id;
                cartonNo = carton.cartonno;
                sscc = carton.sscc;
                actualQty = carton.actualquantity;
            }

            // 4. UPDATE PRODUCT CODE
            const string updatePcSql = @"
                UPDATE ProductCodes 
                SET Status = @Status, CartonId = @CartonId, ScannedAt = @ScannedAt, ScannedBy = @ScannedBy
                WHERE Id = @Id";
            await connection.ExecuteAsync(updatePcSql, new
            {
                Id = (Guid)pc.id,
                Status = ProductCodeStatus.Scanned.ToString(),
                CartonId = cartonId,
                ScannedAt = DateTime.UtcNow,
                ScannedBy = _currentUserService.UserId
            }, transaction);

            // 5. UPDATE CARTON QUANTITY
            actualQty++;
            string cartonStatus = req.Mode == "PrePrinted" ? CartonStatus.Filling.ToString() : CartonStatus.Open.ToString();
            DateTime? closedAt = null;

            if (actualQty >= productPerCarton)
            {
                cartonStatus = CartonStatus.Closed.ToString();
                closedAt = DateTime.UtcNow;
            }

            const string updateCartonSql = @"
                UPDATE Cartons 
                SET ActualQuantity = @ActualQuantity, Status = @Status, ClosedAt = @ClosedAt
                WHERE Id = @Id";
            await connection.ExecuteAsync(updateCartonSql, new
            {
                Id = cartonId,
                ActualQuantity = actualQty,
                Status = cartonStatus,
                ClosedAt = closedAt
            }, transaction);

            transaction.Commit();

            // Log Audit
            await _auditLogService.LogAsync("ProductCodes", pc.id, "Scan", null, new { CartonId = cartonId, CartonNo = cartonNo });
            if (closedAt != null)
            {
                await _auditLogService.LogAsync("Cartons", cartonId, "Close", null, new { CartonNo = cartonNo, SSCC = sscc });
            }

            string responseStatus = closedAt != null ? "CartonClosed" : "Success";
            string successMsg = closedAt != null 
                ? $"Koli tamamlandı ve kapatıldı! ({cartonNo})" 
                : $"Başarıyla okutuldu. Koli doluluk: {actualQty}/{productPerCarton}";

            return new ScanResponse(
                true,
                successMsg,
                req.RawCode,
                pc.gtin,
                pc.serialno,
                cartonNo,
                sscc,
                actualQty,
                productPerCarton,
                responseStatus,
                cartonId
            );
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            return new ScanResponse(false, $"Sistem hatası: {ex.Message}", req.RawCode, null, null, null, null, 0, 0, "Error");
        }
    }

    private async Task<string> GenerateSSCC18Async(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        // SSCC-18 Structure:
        // Digit 1: Extension digit (e.g. 3 for Carton/Pallet packages)
        // Digits 2-10: GS1 Company Prefix (e.g. 463047737 - 9 digits)
        // Digits 11-17: Serial Reference (7 digits unique sequence)
        // Digit 18: Luhn Check Digit
        const string extensionDigit = "3";
        const string companyPrefix = "463047737"; // 9 digits

        // Get a unique sequence number for the serial reference.
        int totalUnits = await connection.ExecuteScalarAsync<int>(
            "SELECT nextval('sscc_seq')", null, transaction);

        string serialRef = totalUnits.ToString().PadLeft(7, '0');
        string baseCode = extensionDigit + companyPrefix + serialRef; // 17 digits

        // Calculate check digit
        int checkDigit = CalculateLuhnCheckDigit(baseCode);

        return baseCode + checkDigit;
    }

        private static int CalculateLuhnCheckDigit(string baseCode)
        {
            // Alternating multiplier 3 and 1 from right to left
            int sum = 0;
            bool multiplyBy3 = true;

            for (int i = baseCode.Length - 1; i >= 0; i--)
            {
                int digit = baseCode[i] - '0';
                sum += digit * (multiplyBy3 ? 3 : 1);
                multiplyBy3 = !multiplyBy3;
            }

            int remainder = sum % 10;
            return remainder == 0 ? 0 : 10 - remainder;
        }
    }

public record GetCurrentCartonQuery(Guid OrderId, Guid StationId) : IRequest<CurrentCartonDto>;

public record CurrentCartonDto(
    bool HasOpenCarton,
    string? CartonNo,
    string? Sscc,
    int CartonCurrentQty,
    int CartonTargetQty,
    int CompletedCartonsCount,
    int TotalScannedCount,
    int ExpectedQuantity,
    Guid? StationId,
    string? StationName
);

public class GetCurrentCartonQueryHandler : IRequestHandler<GetCurrentCartonQuery, CurrentCartonDto>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public GetCurrentCartonQueryHandler(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<CurrentCartonDto> Handle(GetCurrentCartonQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();

        // 1. Get order details (product per carton, expected quantity, stockcode)
        const string orderSql = "SELECT ProductPerCarton, ExpectedQuantity, StockCode FROM Orders WHERE Id = @OrderId";
        var order = await connection.QueryFirstOrDefaultAsync<dynamic>(orderSql, new { OrderId = request.OrderId });
        if (order == null)
        {
            return new CurrentCartonDto(false, null, null, 0, 0, 0, 0, 0, null, null);
        }

        int productPerCarton = order.productpercarton;
        int expectedQuantity = order.expectedquantity;
        string? stockCode = order.stockcode;

        // 1.5 Get Station Name
        var stationName = await connection.ExecuteScalarAsync<string>("SELECT Name FROM Stations WHERE Id = @StationId", new { StationId = request.StationId });

        // 2. Get active open carton details for this station and stock code
        const string openCartonSql = @"
            SELECT CartonNo, SSCC, ActualQuantity, TargetQuantity 
            FROM Cartons 
            WHERE OrderId = @OrderId AND StockCode = @StockCode AND StationId = @StationId AND Status = 'Open' 
            ORDER BY CreatedAt DESC 
            LIMIT 1";
        var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(openCartonSql, new { OrderId = request.OrderId, StockCode = stockCode, StationId = request.StationId });

        bool hasOpenCarton = carton != null;
        string? cartonNo = carton?.cartonno;
        string? sscc = carton?.sscc;
        int cartonCurrentQty = carton != null ? (int)carton.actualquantity : 0;
        int cartonTargetQty = carton != null ? (int)carton.targetquantity : productPerCarton;

        // 3. Get completed cartons count (for order)
        const string completedCountSql = "SELECT COUNT(*) FROM Cartons WHERE OrderId = @OrderId AND Status != 'Open'";
        int completedCartonsCount = await connection.ExecuteScalarAsync<int>(completedCountSql, new { OrderId = request.OrderId });

        // 4. Get total scanned count (for order)
        const string totalScannedSql = "SELECT COUNT(*) FROM ProductCodes WHERE OrderId = @OrderId AND Status = 'Scanned'";
        int totalScannedCount = await connection.ExecuteScalarAsync<int>(totalScannedSql, new { OrderId = request.OrderId });


        return new CurrentCartonDto(
            HasOpenCarton: hasOpenCarton,
            CartonNo: cartonNo,
            Sscc: sscc,
            CartonCurrentQty: cartonCurrentQty,
            CartonTargetQty: cartonTargetQty,
            CompletedCartonsCount: completedCartonsCount,
            TotalScannedCount: totalScannedCount,
            ExpectedQuantity: expectedQuantity,
            StationId: request.StationId,
            StationName: stationName
        );
    }
}
