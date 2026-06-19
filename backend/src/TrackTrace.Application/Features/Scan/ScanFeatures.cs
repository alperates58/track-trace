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
            
            if (pc == null)
            {
                return new ScanResponse(false, "Sistemde kayıtlı olmayan ürün barkodu!", req.RawCode, null, null, null, null, 0, 0, "Error");
            }

            string pcStatusStr = pc.status;
            if (pcStatusStr != ProductCodeStatus.Uploaded.ToString())
            {
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

            // 3. SELECT OPEN CARTON WITH LOCK
            const string openCartonSql = @"
                SELECT * FROM Cartons 
                WHERE OrderId = @OrderId AND Status = 'Open' 
                ORDER BY CreatedAt DESC 
                LIMIT 1 FOR UPDATE";
            var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(openCartonSql, new { OrderId = req.OrderId }, transaction);

            Guid cartonId;
            string cartonNo;
            string sscc;
            int actualQty;
            bool newlyCreated = false;

            if (carton == null)
            {
                // Create a new Carton
                cartonId = Guid.NewGuid();
                
                // Generate CartonNo sequence
                int cartonSequence = await connection.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM Cartons WHERE OrderId = @OrderId", new { OrderId = req.OrderId }, transaction) + 1;
                cartonNo = $"K-{orderNo}-{cartonSequence:D4}";

                // Generate SSCC-18 (Serial Shipping Container Code)
                sscc = await GenerateSSCC18Async(connection, transaction);
                actualQty = 0;

                const string insertCartonSql = @"
                    INSERT INTO Cartons (Id, OrderId, CartonNo, SSCC, TargetQuantity, ActualQuantity, Status, CreatedBy, CreatedAt)
                    VALUES (@Id, @OrderId, @CartonNo, @SSCC, @TargetQuantity, @ActualQuantity, @Status, @CreatedBy, @CreatedAt)";

                await connection.ExecuteAsync(insertCartonSql, new
                {
                    Id = cartonId,
                    OrderId = req.OrderId,
                    CartonNo = cartonNo,
                    SSCC = sscc,
                    TargetQuantity = productPerCarton,
                    ActualQuantity = 0,
                    Status = CartonStatus.Open.ToString(),
                    CreatedBy = _currentUserService.UserId,
                    CreatedAt = DateTime.UtcNow
                }, transaction);

                newlyCreated = true;
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
            string cartonStatus = CartonStatus.Open.ToString();
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
        // We can just use the total number of cartons + pallets in the DB to ensure uniqueness.
        int totalUnits = await connection.ExecuteScalarAsync<int>(
            "SELECT (SELECT COALESCE(COUNT(*), 0) FROM Cartons) + (SELECT COALESCE(COUNT(*), 0) FROM Pallets)", 
            null, transaction) + 1;

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

public record GetCurrentCartonQuery(Guid OrderId) : IRequest<CurrentCartonDto>;

public record CurrentCartonDto(
    bool HasOpenCarton,
    string? CartonNo,
    string? Sscc,
    int CartonCurrentQty,
    int CartonTargetQty,
    int CompletedCartonsCount,
    int TotalScannedCount,
    int ExpectedQuantity
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

        // 1. Get order details (product per carton, expected quantity)
        const string orderSql = "SELECT ProductPerCarton, ExpectedQuantity FROM Orders WHERE Id = @OrderId";
        var order = await connection.QueryFirstOrDefaultAsync<dynamic>(orderSql, new { OrderId = request.OrderId });
        if (order == null)
        {
            return new CurrentCartonDto(false, null, null, 0, 0, 0, 0, 0);
        }

        int productPerCarton = order.productpercarton;
        int expectedQuantity = order.expectedquantity;

        // 2. Get active open carton details
        const string openCartonSql = @"
            SELECT CartonNo, SSCC, ActualQuantity, TargetQuantity 
            FROM Cartons 
            WHERE OrderId = @OrderId AND Status = 'Open' 
            ORDER BY CreatedAt DESC 
            LIMIT 1";
        var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(openCartonSql, new { OrderId = request.OrderId });

        bool hasOpenCarton = carton != null;
        string? cartonNo = carton?.cartonno;
        string? sscc = carton?.sscc;
        int cartonCurrentQty = carton != null ? (int)carton.actualquantity : 0;
        int cartonTargetQty = carton != null ? (int)carton.targetquantity : productPerCarton;

        // 3. Get completed cartons count
        const string completedCountSql = "SELECT COUNT(*) FROM Cartons WHERE OrderId = @OrderId AND Status != 'Open'";
        int completedCartonsCount = await connection.ExecuteScalarAsync<int>(completedCountSql, new { OrderId = request.OrderId });

        // 4. Get total scanned count
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
            ExpectedQuantity: expectedQuantity
        );
    }
}
