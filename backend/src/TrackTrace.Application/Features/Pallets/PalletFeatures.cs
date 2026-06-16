using System;
using System.Collections.Generic;
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

namespace TrackTrace.Application.Features.Pallets;

public record GetPalletsQuery(int PageNumber = 1, int PageSize = 10, string? Search = null, string? Status = null, Guid? OrderId = null)
    : IRequest<(IEnumerable<PalletDto> Items, int TotalCount)>;

public record GetPalletByIdQuery(Guid Id) : IRequest<PalletDto>;

public record CreatePalletCommand(Guid OrderId) : IRequest<Guid>;

public record AddCartonToPalletCommand(Guid PalletId, string CartonSSCC) : IRequest<Unit>;

public record ClosePalletCommand(Guid Id) : IRequest<Unit>;

public record PrintPalletLabelCommand(Guid Id, string Format) : IRequest<(byte[]? FileContent, string? ZplText)>;

public class PalletHandlers :
    IRequestHandler<GetPalletsQuery, (IEnumerable<PalletDto> Items, int TotalCount)>,
    IRequestHandler<GetPalletByIdQuery, PalletDto>,
    IRequestHandler<CreatePalletCommand, Guid>,
    IRequestHandler<AddCartonToPalletCommand, Unit>,
    IRequestHandler<ClosePalletCommand, Unit>,
    IRequestHandler<PrintPalletLabelCommand, (byte[]? FileContent, string? ZplText)>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILabelGenerator _labelGenerator;

    public PalletHandlers(
        IDbConnectionFactory dbConnectionFactory,
        ICurrentUserService currentUserService,
        IAuditLogService auditLogService,
        ILabelGenerator labelGenerator)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
        _labelGenerator = labelGenerator;
    }

    public async Task<(IEnumerable<PalletDto> Items, int TotalCount)> Handle(GetPalletsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var builder = new SqlBuilder();

        var selector = builder.AddTemplate(@"
            SELECT p.*, o.OrderNo,
                   COALESCE((SELECT COUNT(*) FROM PalletCartons pc WHERE pc.PalletId = p.Id), 0) as CartonCount
            FROM Pallets p
            INNER JOIN Orders o ON p.OrderId = o.Id
            /**where**/
            ORDER BY p.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset", new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });

        var countTemplate = builder.AddTemplate(@"
            SELECT COUNT(*) 
            FROM Pallets p
            INNER JOIN Orders o ON p.OrderId = o.Id
            /**where**/");

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            builder.Where("(p.PalletNo ILIKE @Search OR p.SSCC ILIKE @Search OR o.OrderNo ILIKE @Search)",
                new { Search = $"%{request.Search}%" });
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            builder.Where("p.Status = @Status", new { Status = request.Status });
        }

        if (request.OrderId.HasValue)
        {
            builder.Where("p.OrderId = @OrderId", new { OrderId = request.OrderId.Value });
        }

        var items = await connection.QueryAsync<dynamic>(selector.RawSql, selector.Parameters);
        var totalCount = await connection.ExecuteScalarAsync<int>(countTemplate.RawSql, countTemplate.Parameters);

        var palletDtos = items.Select(x => new PalletDto(
            (Guid)x.id,
            (Guid)x.orderid,
            (string)x.orderno,
            (string)x.palletno,
            (string)x.sscc,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime?)x.closedat,
            (DateTime?)x.printedat,
            Convert.ToInt32(x.CartonCount)
        ));

        return (palletDtos, totalCount);
    }

    public async Task<PalletDto> Handle(GetPalletByIdQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT p.*, o.OrderNo,
                   COALESCE((SELECT COUNT(*) FROM PalletCartons pc WHERE pc.PalletId = p.Id), 0) as CartonCount
            FROM Pallets p
            INNER JOIN Orders o ON p.OrderId = o.Id
            WHERE p.Id = @Id";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { Id = request.Id });
        if (x == null)
        {
            throw new KeyNotFoundException("Palet bulunamadı.");
        }

        return new PalletDto(
            (Guid)x.id,
            (Guid)x.orderid,
            (string)x.orderno,
            (string)x.palletno,
            (string)x.sscc,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime?)x.closedat,
            (DateTime?)x.printedat,
            Convert.ToInt32(x.CartonCount)
        );
    }

    public async Task<Guid> Handle(CreatePalletCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != ConnectionState.Open) connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            // Load Order
            var order = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT OrderNo, Status FROM Orders WHERE Id = @Id", new { Id = request.OrderId }, transaction);
            if (order == null) throw new KeyNotFoundException("Sipariş bulunamadı.");
            if (order.status != OrderStatus.Active.ToString())
            {
                throw new InvalidOperationException("Yalnızca aktif siparişler için palet oluşturulabilir.");
            }

            string orderNo = order.orderno;
            var palletId = Guid.NewGuid();

            // Generate PalletNo sequence
            int sequence = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM Pallets WHERE OrderId = @OrderId", new { OrderId = request.OrderId }, transaction) + 1;
            string palletNo = $"P-{orderNo}-{sequence:D4}";

            // Generate SSCC-18 for Pallet
            string sscc = await GenerateSSCC18Async(connection, transaction);

            const string sql = @"
                INSERT INTO Pallets (Id, OrderId, PalletNo, SSCC, Status, CreatedBy, CreatedAt)
                VALUES (@Id, @OrderId, @PalletNo, @SSCC, @Status, @CreatedBy, @CreatedAt)";

            await connection.ExecuteAsync(sql, new
            {
                Id = palletId,
                OrderId = request.OrderId,
                PalletNo = palletNo,
                SSCC = sscc,
                Status = PalletStatus.Open.ToString(),
                CreatedBy = _currentUserService.UserId,
                CreatedAt = DateTime.UtcNow
            }, transaction);

            transaction.Commit();
            await _auditLogService.LogAsync("Pallets", palletId, "Create", null, new { PalletNo = palletNo, SSCC = sscc });
            return palletId;
        }
        catch (Exception)
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Unit> Handle(AddCartonToPalletCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != ConnectionState.Open) connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            // 1. Load Pallet with row-locking
            var pallet = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM Pallets WHERE Id = @Id FOR UPDATE", new { Id = request.PalletId }, transaction);
            if (pallet == null) throw new KeyNotFoundException("Palet bulunamadı.");
            if (pallet.status != PalletStatus.Open.ToString())
            {
                throw new InvalidOperationException("Yalnızca açık olan paletlere koli eklenebilir.");
            }

            Guid orderId = pallet.orderid;

            // Load Order parameters
            var order = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT CartonPerPallet FROM Orders WHERE Id = @OrderId", new { OrderId = orderId }, transaction);
            int cartonPerPallet = order.cartonperpallet;

            // Check current carton count
            int currentCartonCount = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM PalletCartons WHERE PalletId = @PalletId", new { PalletId = request.PalletId }, transaction);

            if (currentCartonCount >= cartonPerPallet)
            {
                throw new InvalidOperationException("Palet kapasitesi dolu.");
            }

            // 2. Load Carton by SSCC with row-locking
            var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM Cartons WHERE SSCC = @SSCC FOR UPDATE", new { SSCC = request.CartonSSCC }, transaction);
            if (carton == null)
            {
                throw new KeyNotFoundException("Belirtilen SSCC'ye ait koli bulunamadı.");
            }

            Guid cartonOrderId = carton.orderid;
            if (cartonOrderId != orderId)
            {
                throw new InvalidOperationException("Koli ile palet siparişleri eşleşmiyor.");
            }

            string cartonStatus = carton.status;
            if (cartonStatus != CartonStatus.Closed.ToString() && cartonStatus != CartonStatus.Printed.ToString())
            {
                throw new InvalidOperationException("Sadece kapalı veya yazdırılmış koliler palete eklenebilir.");
            }

            // Check if carton is already on any pallet
            bool alreadyPalletized = await connection.ExecuteScalarAsync<bool>(
                "SELECT EXISTS(SELECT 1 FROM PalletCartons WHERE CartonId = @CartonId)", new { CartonId = (Guid)carton.id }, transaction);
            if (alreadyPalletized)
            {
                throw new InvalidOperationException("Bu koli zaten başka bir palete eklenmiş.");
            }

            // 3. Add to PalletCartons
            var palletCartonId = Guid.NewGuid();
            await connection.ExecuteAsync(
                "INSERT INTO PalletCartons (Id, PalletId, CartonId, CreatedAt) VALUES (@Id, @PalletId, @CartonId, @CreatedAt)",
                new { Id = palletCartonId, PalletId = request.PalletId, CartonId = (Guid)carton.id, CreatedAt = DateTime.UtcNow }, transaction);

            // 4. Update Carton Status to Palletized
            await connection.ExecuteAsync(
                "UPDATE Cartons SET Status = @Status WHERE Id = @Id",
                new { Id = (Guid)carton.id, Status = CartonStatus.Palletized.ToString() }, transaction);

            currentCartonCount++;

            // 5. Auto-close Pallet if Capacity is Full
            if (currentCartonCount >= cartonPerPallet)
            {
                await connection.ExecuteAsync(
                    "UPDATE Pallets SET Status = @Status, ClosedAt = @ClosedAt WHERE Id = @Id",
                    new { Id = request.PalletId, Status = PalletStatus.Closed.ToString(), ClosedAt = DateTime.UtcNow }, transaction);
                
                await _auditLogService.LogAsync("Pallets", request.PalletId, "Close", null, new { Reason = "CapacityReached" });
            }

            transaction.Commit();
            await _auditLogService.LogAsync("Pallets", request.PalletId, "AddCarton", null, new { CartonId = (Guid)carton.id, CartonSSCC = request.CartonSSCC });
            return Unit.Value;
        }
        catch (Exception)
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Unit> Handle(ClosePalletCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var pallet = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Status FROM Pallets WHERE Id = @Id", new { Id = request.Id });
        if (pallet == null) throw new KeyNotFoundException("Palet bulunamadı.");
        if (pallet.status != PalletStatus.Open.ToString())
        {
            throw new InvalidOperationException("Yalnızca açık olan paletler kapatılabilir.");
        }

        await connection.ExecuteAsync(
            "UPDATE Pallets SET Status = @Status, ClosedAt = @ClosedAt WHERE Id = @Id",
            new { Id = request.Id, Status = PalletStatus.Closed.ToString(), ClosedAt = DateTime.UtcNow });

        await _auditLogService.LogAsync("Pallets", request.Id, "Close", null, new { Manual = true });
        return Unit.Value;
    }

    public async Task<(byte[]? FileContent, string? ZplText)> Handle(PrintPalletLabelCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var palletDto = await Handle(new GetPalletByIdQuery(request.Id), cancellationToken);

        const string orderSql = @"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o WHERE o.Id = @OrderId";
        var orderRaw = await connection.QueryFirstOrDefaultAsync<dynamic>(orderSql, new { OrderId = palletDto.OrderId });
        if (orderRaw == null) throw new KeyNotFoundException("Sipariş bulunamadı.");

        var orderDto = new OrderDto(
            (Guid)orderRaw.id,
            (string)orderRaw.orderno,
            (string)orderRaw.customername,
            (string?)orderRaw.stockcode,
            (string?)orderRaw.productname,
            (string)orderRaw.gtin,
            (int)orderRaw.productpercarton,
            (int)orderRaw.cartonperpallet,
            (int)orderRaw.expectedquantity,
            (string?)orderRaw.description,
            (string)orderRaw.status,
            (DateTime)orderRaw.createdat,
            (DateTime)orderRaw.updatedat,
            Convert.ToInt32(orderRaw.ScannedCount)
        );

        byte[]? pdfData = null;
        string? zplData = null;

        if (request.Format.Equals("PDF", StringComparison.OrdinalIgnoreCase))
        {
            pdfData = _labelGenerator.GeneratePalletPdfLabel(palletDto, orderDto, palletDto.CartonCount);
        }
        else
        {
            zplData = _labelGenerator.GeneratePalletZplLabel(palletDto, orderDto, palletDto.CartonCount);
        }

        // Record print job
        var printJobId = Guid.NewGuid();
        const string printJobSql = @"
            INSERT INTO PrintJobs (Id, LabelType, EntityId, PrintedBy, PrintCount, Format, CreatedAt)
            VALUES (@Id, @LabelType, @EntityId, @PrintedBy, 1, @Format, @CreatedAt)";

        await connection.ExecuteAsync(printJobSql, new
        {
            Id = printJobId,
            LabelType = "Pallet",
            EntityId = request.Id,
            PrintedBy = _currentUserService.UserId,
            Format = request.Format.ToUpper(),
            CreatedAt = DateTime.UtcNow
        });

        // Update Pallet Status to Printed if not already shipped
        if (palletDto.Status != PalletStatus.Shipped.ToString())
        {
            await connection.ExecuteAsync(
                "UPDATE Pallets SET Status = @Status, PrintedAt = @PrintedAt WHERE Id = @Id",
                new { Id = request.Id, Status = PalletStatus.Printed.ToString(), PrintedAt = DateTime.UtcNow });
        }

        await _auditLogService.LogAsync("Pallets", request.Id, "PrintLabel", null, new { Format = request.Format });

        return (pdfData, zplData);
    }

    private async Task<string> GenerateSSCC18Async(NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        const string extensionDigit = "3";
        const string companyPrefix = "463047737"; // 9 digits

        int totalUnits = await connection.ExecuteScalarAsync<int>(
            "SELECT (SELECT COALESCE(COUNT(*), 0) FROM Cartons) + (SELECT COALESCE(COUNT(*), 0) FROM Pallets)", 
            null, transaction) + 1;

        string serialRef = totalUnits.ToString().PadLeft(7, '0');
        string baseCode = extensionDigit + companyPrefix + serialRef;

        int checkDigit = CalculateLuhnCheckDigit(baseCode);
        return baseCode + checkDigit;
    }

    private int CalculateLuhnCheckDigit(string baseCode)
    {
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
