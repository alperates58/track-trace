using System.Data;
using Dapper;
using MediatR;
using Npgsql;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Shipments;

public record ShipmentSummaryDto(
    Guid Id,
    string ShipmentNo,
    string Status,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    int PalletCount,
    int CartonCount,
    int ProductCount);

public record ShipmentItemDto(
    Guid Id,
    string ItemType,
    Guid EntityId,
    string EntityNo,
    string SSCC,
    string OrderNo,
    int CartonCount,
    int ProductCount,
    DateTime ScannedAt,
    string? ScannedBy);

public record ShipmentDetailDto(ShipmentSummaryDto Shipment, IReadOnlyList<ShipmentItemDto> Items);
public record ShipmentScanResult(string ItemType, string EntityNo, string SSCC, string Message);

public record GetShipmentsQuery(int PageNumber = 1, int PageSize = 50, string? Status = null)
    : IRequest<(IReadOnlyList<ShipmentSummaryDto> Items, int TotalCount)>;
public record GetShipmentByIdQuery(Guid Id) : IRequest<ShipmentDetailDto>;
public record CreateShipmentCommand : IRequest<Guid>;
public record ScanShipmentItemCommand(Guid ShipmentId, string Code) : IRequest<ShipmentScanResult>;
public record RemoveShipmentItemCommand(Guid ShipmentId, Guid ItemId) : IRequest<Unit>;
public record CompleteShipmentCommand(Guid Id) : IRequest<Unit>;
public record CancelShipmentCommand(Guid Id) : IRequest<Unit>;

public class ShipmentHandlers :
    IRequestHandler<GetShipmentsQuery, (IReadOnlyList<ShipmentSummaryDto> Items, int TotalCount)>,
    IRequestHandler<GetShipmentByIdQuery, ShipmentDetailDto>,
    IRequestHandler<CreateShipmentCommand, Guid>,
    IRequestHandler<ScanShipmentItemCommand, ShipmentScanResult>,
    IRequestHandler<RemoveShipmentItemCommand, Unit>,
    IRequestHandler<CompleteShipmentCommand, Unit>,
    IRequestHandler<CancelShipmentCommand, Unit>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;

    public ShipmentHandlers(
        IDbConnectionFactory dbConnectionFactory,
        ICurrentUserService currentUserService,
        IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
        _auditLogService = auditLogService;
    }

    public async Task<(IReadOnlyList<ShipmentSummaryDto> Items, int TotalCount)> Handle(
        GetShipmentsQuery request,
        CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var where = string.IsNullOrWhiteSpace(request.Status) ? string.Empty : "WHERE s.Status = @Status";
        var parameters = new
        {
            request.Status,
            Limit = Math.Clamp(request.PageSize, 1, 200),
            Offset = Math.Max(0, request.PageNumber - 1) * Math.Clamp(request.PageSize, 1, 200)
        };

        var rows = await connection.QueryAsync<dynamic>($@"
            SELECT s.Id, s.ShipmentNo, s.Status, s.CreatedAt, s.CompletedAt,
                   (SELECT COUNT(*) FROM ShipmentItems si WHERE si.ShipmentId = s.Id AND si.PalletId IS NOT NULL AND si.RemovedAt IS NULL) AS PalletCount,
                   (SELECT COUNT(*) FROM ShipmentItems si WHERE si.ShipmentId = s.Id AND si.CartonId IS NOT NULL AND si.RemovedAt IS NULL)
                     + COALESCE((SELECT SUM((SELECT COUNT(*) FROM PalletCartons pc WHERE pc.PalletId = si.PalletId))
                                 FROM ShipmentItems si WHERE si.ShipmentId = s.Id AND si.PalletId IS NOT NULL AND si.RemovedAt IS NULL), 0) AS CartonCount,
                   COALESCE((SELECT SUM(c.ActualQuantity)
                             FROM ShipmentItems si JOIN Cartons c ON c.Id = si.CartonId
                             WHERE si.ShipmentId = s.Id AND si.RemovedAt IS NULL), 0)
                     + COALESCE((SELECT SUM(c.ActualQuantity)
                                 FROM ShipmentItems si
                                 JOIN PalletCartons pc ON pc.PalletId = si.PalletId
                                 JOIN Cartons c ON c.Id = pc.CartonId
                                 WHERE si.ShipmentId = s.Id AND si.RemovedAt IS NULL), 0) AS ProductCount
            FROM Shipments s
            {where}
            ORDER BY s.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset", parameters);

        var totalCount = await connection.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM Shipments s {where}", parameters);

        return (rows.Select(MapSummary).ToList(), totalCount);
    }

    public async Task<ShipmentDetailDto> Handle(GetShipmentByIdQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var row = await connection.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT s.Id, s.ShipmentNo, s.Status, s.CreatedAt, s.CompletedAt,
                   (SELECT COUNT(*) FROM ShipmentItems si WHERE si.ShipmentId = s.Id AND si.PalletId IS NOT NULL AND si.RemovedAt IS NULL) AS PalletCount,
                   (SELECT COUNT(*) FROM ShipmentItems si WHERE si.ShipmentId = s.Id AND si.CartonId IS NOT NULL AND si.RemovedAt IS NULL)
                     + COALESCE((SELECT SUM((SELECT COUNT(*) FROM PalletCartons pc WHERE pc.PalletId = si.PalletId))
                                 FROM ShipmentItems si WHERE si.ShipmentId = s.Id AND si.PalletId IS NOT NULL AND si.RemovedAt IS NULL), 0) AS CartonCount,
                   COALESCE((SELECT SUM(c.ActualQuantity)
                             FROM ShipmentItems si JOIN Cartons c ON c.Id = si.CartonId
                             WHERE si.ShipmentId = s.Id AND si.RemovedAt IS NULL), 0)
                     + COALESCE((SELECT SUM(c.ActualQuantity)
                                 FROM ShipmentItems si
                                 JOIN PalletCartons pc ON pc.PalletId = si.PalletId
                                 JOIN Cartons c ON c.Id = pc.CartonId
                                 WHERE si.ShipmentId = s.Id AND si.RemovedAt IS NULL), 0) AS ProductCount
            FROM Shipments s
            WHERE s.Id = @Id", new { request.Id });

        if (row == null)
        {
            throw new KeyNotFoundException("Sevkiyat bulunamadı.");
        }

        var itemRows = await connection.QueryAsync<dynamic>(@"
            SELECT si.Id,
                   CASE WHEN si.PalletId IS NOT NULL THEN 'Pallet' ELSE 'Carton' END AS ItemType,
                   COALESCE(si.PalletId, si.CartonId) AS EntityId,
                   COALESCE(p.PalletNo, c.CartonNo) AS EntityNo,
                   COALESCE(p.SSCC, c.SSCC) AS SSCC,
                   o.OrderNo,
                   CASE WHEN si.PalletId IS NOT NULL
                        THEN (SELECT COUNT(*) FROM PalletCartons pc WHERE pc.PalletId = si.PalletId)
                        ELSE 1 END AS CartonCount,
                   CASE WHEN si.PalletId IS NOT NULL
                        THEN COALESCE((SELECT SUM(pcCarton.ActualQuantity)
                                      FROM PalletCartons pc JOIN Cartons pcCarton ON pcCarton.Id = pc.CartonId
                                      WHERE pc.PalletId = si.PalletId), 0)
                        ELSE c.ActualQuantity END AS ProductCount,
                   si.ScannedAt,
                   u.Name AS ScannedBy
            FROM ShipmentItems si
            LEFT JOIN Pallets p ON p.Id = si.PalletId
            LEFT JOIN Cartons c ON c.Id = si.CartonId
            JOIN Orders o ON o.Id = COALESCE(p.OrderId, c.OrderId)
            LEFT JOIN Users u ON u.Id = si.ScannedBy
            WHERE si.ShipmentId = @Id AND si.RemovedAt IS NULL
            ORDER BY si.ScannedAt DESC", new { request.Id });

        var items = itemRows.Select(x => new ShipmentItemDto(
            (Guid)x.id,
            (string)x.itemtype,
            (Guid)x.entityid,
            (string)x.entityno,
            (string)x.sscc,
            (string)x.orderno,
            Convert.ToInt32(x.cartoncount),
            Convert.ToInt32(x.productcount),
            (DateTime)x.scannedat,
            (string?)x.scannedby)).ToList();

        return new ShipmentDetailDto(MapSummary(row), items);
    }

    public async Task<Guid> Handle(CreateShipmentCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var id = Guid.NewGuid();
        var sequence = await connection.ExecuteScalarAsync<long>("SELECT nextval('shipment_no_seq')", transaction: transaction);
        var shipmentNo = $"SVK-{DateTime.UtcNow:yyyy}-{sequence:D6}";

        await connection.ExecuteAsync(@"
            INSERT INTO Shipments (Id, ShipmentNo, Status, CreatedBy, CreatedAt)
            VALUES (@Id, @ShipmentNo, @Status, @CreatedBy, @CreatedAt)", new
        {
            Id = id,
            ShipmentNo = shipmentNo,
            Status = ShipmentStatus.Draft.ToString(),
            CreatedBy = _currentUserService.UserId,
            CreatedAt = DateTime.UtcNow
        }, transaction);

        await transaction.CommitAsync(cancellationToken);
        await _auditLogService.LogAsync("Shipments", id, "Create", null, new { ShipmentNo = shipmentNo });
        return id;
    }

    public async Task<ShipmentScanResult> Handle(ScanShipmentItemCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            throw new InvalidOperationException("Lütfen koli veya palet barkodu okutun.");
        }

        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var shipment = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT Id, Status FROM Shipments WHERE Id = @Id FOR UPDATE", new { Id = request.ShipmentId }, transaction);
            EnsureDraft(shipment);

            var cleanSscc = Gs1AutoHelper.ExtractSscc(request.Code.Trim());
            var pallet = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT Id, PalletNo, SSCC, Status FROM Pallets WHERE SSCC = @SSCC FOR UPDATE", new { SSCC = cleanSscc }, transaction);

            ShipmentScanResult result;
            if (pallet != null)
            {
                var status = (string)pallet.status;
                if (status != PalletStatus.Closed.ToString() && status != PalletStatus.Printed.ToString())
                {
                    throw new InvalidOperationException(status == PalletStatus.Shipped.ToString()
                        ? "Bu palet daha önce sevk edilmiş."
                        : "Yalnızca kapalı veya etiketi yazdırılmış paletler sevk edilebilir.");
                }

                var cartonCount = await connection.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM PalletCartons WHERE PalletId = @PalletId", new { PalletId = (Guid)pallet.id }, transaction);
                if (cartonCount == 0)
                {
                    throw new InvalidOperationException("Boş palet sevk edilemez.");
                }

                var invalidCartonCount = await connection.ExecuteScalarAsync<int>(@"
                    SELECT COUNT(*) FROM PalletCartons pc
                    JOIN Cartons c ON c.Id = pc.CartonId
                    WHERE pc.PalletId = @PalletId AND c.Status <> @Status",
                    new { PalletId = (Guid)pallet.id, Status = CartonStatus.Palletized.ToString() }, transaction);
                if (invalidCartonCount > 0)
                {
                    throw new InvalidOperationException("Palet içindeki kolilerden bazıları sevke uygun değil.");
                }

                var hasConflict = await connection.ExecuteScalarAsync<bool>(@"
                    SELECT EXISTS(
                        SELECT 1 FROM ShipmentItems si
                        WHERE si.RemovedAt IS NULL AND
                              (si.PalletId = @PalletId OR si.CartonId IN
                                  (SELECT CartonId FROM PalletCartons WHERE PalletId = @PalletId)))",
                    new { PalletId = (Guid)pallet.id }, transaction);
                if (hasConflict)
                {
                    throw new InvalidOperationException("Bu palet veya içindeki bir koli zaten başka bir sevkiyatta.");
                }

                await InsertItem(connection, transaction, request.ShipmentId, null, (Guid)pallet.id);
                result = new ShipmentScanResult("Pallet", (string)pallet.palletno, (string)pallet.sscc, "Palet sevkiyata eklendi.");
            }
            else
            {
                var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT Id, CartonNo, SSCC, Status FROM Cartons WHERE SSCC = @SSCC FOR UPDATE", new { SSCC = cleanSscc }, transaction);
                if (carton == null)
                {
                    throw new KeyNotFoundException("Bu barkoda ait koli veya palet bulunamadı.");
                }

                var parentPallet = await connection.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT p.PalletNo, p.SSCC FROM PalletCartons pc
                    JOIN Pallets p ON p.Id = pc.PalletId
                    WHERE pc.CartonId = @CartonId", new { CartonId = (Guid)carton.id }, transaction);
                if (parentPallet != null)
                {
                    throw new InvalidOperationException($"Bu koli paletli. Palet barkodunu okutun: {parentPallet.palletno}");
                }

                var status = (string)carton.status;
                if (status != CartonStatus.Closed.ToString() && status != CartonStatus.Printed.ToString())
                {
                    throw new InvalidOperationException(status == CartonStatus.Shipped.ToString()
                        ? "Bu koli daha önce sevk edilmiş."
                        : "Yalnızca kapalı veya etiketi yazdırılmış koliler sevk edilebilir.");
                }

                var hasConflict = await connection.ExecuteScalarAsync<bool>(@"
                    SELECT EXISTS(SELECT 1 FROM ShipmentItems WHERE CartonId = @CartonId AND RemovedAt IS NULL)",
                    new { CartonId = (Guid)carton.id }, transaction);
                if (hasConflict)
                {
                    throw new InvalidOperationException("Bu koli zaten başka bir sevkiyatta.");
                }

                await InsertItem(connection, transaction, request.ShipmentId, (Guid)carton.id, null);
                result = new ShipmentScanResult("Carton", (string)carton.cartonno, (string)carton.sscc, "Koli sevkiyata eklendi.");
            }

            await transaction.CommitAsync(cancellationToken);
            await _auditLogService.LogAsync("Shipments", request.ShipmentId, "ScanItem", null, result);
            return result;
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("Bu koli veya palet zaten aktif bir sevkiyatta.");
        }
    }

    public async Task<Unit> Handle(RemoveShipmentItemCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var shipment = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, Status FROM Shipments WHERE Id = @Id FOR UPDATE", new { Id = request.ShipmentId }, transaction);
        EnsureDraft(shipment);

        var affected = await connection.ExecuteAsync(@"
            DELETE FROM ShipmentItems
            WHERE Id = @ItemId AND ShipmentId = @ShipmentId AND RemovedAt IS NULL", new
        {
            request.ItemId,
            request.ShipmentId
        }, transaction);
        if (affected == 0)
        {
            throw new KeyNotFoundException("Sevkiyat kalemi bulunamadı.");
        }

        await transaction.CommitAsync(cancellationToken);
        await _auditLogService.LogAsync("Shipments", request.ShipmentId, "RemoveItem", null, new { request.ItemId });
        return Unit.Value;
    }

    public async Task<Unit> Handle(CompleteShipmentCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var shipment = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, ShipmentNo, Status FROM Shipments WHERE Id = @Id FOR UPDATE", new { request.Id }, transaction);
        EnsureDraft(shipment);

        var items = (await connection.QueryAsync<dynamic>(@"
            SELECT Id, CartonId, PalletId FROM ShipmentItems
            WHERE ShipmentId = @Id AND RemovedAt IS NULL
            ORDER BY ScannedAt FOR UPDATE", new { request.Id }, transaction)).ToList();
        if (items.Count == 0)
        {
            throw new InvalidOperationException("Boş sevkiyat tamamlanamaz.");
        }

        var shippedAt = DateTime.UtcNow;
        foreach (var item in items)
        {
            if (item.palletid != null)
            {
                var palletId = (Guid)item.palletid;
                var pallet = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT Status FROM Pallets WHERE Id = @Id FOR UPDATE", new { Id = palletId }, transaction);
                if (pallet == null)
                {
                    throw new InvalidOperationException("Sevkiyattaki palet bulunamadı.");
                }
                var palletStatus = (string)pallet.status;
                if (palletStatus != PalletStatus.Closed.ToString() && palletStatus != PalletStatus.Printed.ToString())
                {
                    throw new InvalidOperationException("Sevkiyattaki paletlerden biri artık sevke uygun değil.");
                }

                var invalidCartons = await connection.ExecuteScalarAsync<int>(@"
                    SELECT COUNT(*) FROM PalletCartons pc JOIN Cartons c ON c.Id = pc.CartonId
                    WHERE pc.PalletId = @Id AND c.Status <> @Status",
                    new { Id = palletId, Status = CartonStatus.Palletized.ToString() }, transaction);
                if (invalidCartons > 0)
                {
                    throw new InvalidOperationException("Sevkiyattaki paletin koli durumu değişmiş.");
                }

                await connection.ExecuteAsync(@"
                    UPDATE Pallets SET Status = @Status, ShippedAt = @ShippedAt, ShippedBy = @ShippedBy WHERE Id = @Id;
                    UPDATE Cartons SET Status = @CartonStatus, ShippedAt = @ShippedAt, ShippedBy = @ShippedBy
                    WHERE Id IN (SELECT CartonId FROM PalletCartons WHERE PalletId = @Id);", new
                {
                    Id = palletId,
                    Status = PalletStatus.Shipped.ToString(),
                    CartonStatus = CartonStatus.Shipped.ToString(),
                    ShippedAt = shippedAt,
                    ShippedBy = _currentUserService.UserId
                }, transaction);
            }
            else
            {
                var cartonId = (Guid)item.cartonid;
                var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(@"
                    SELECT c.Status, EXISTS(SELECT 1 FROM PalletCartons pc WHERE pc.CartonId = c.Id) AS IsPalletized
                    FROM Cartons c WHERE c.Id = @Id FOR UPDATE", new { Id = cartonId }, transaction);
                if (carton == null)
                {
                    throw new InvalidOperationException("Sevkiyattaki koli bulunamadı.");
                }
                var cartonStatus = (string)carton.status;
                if ((bool)carton.ispalletized ||
                    (cartonStatus != CartonStatus.Closed.ToString() && cartonStatus != CartonStatus.Printed.ToString()))
                {
                    throw new InvalidOperationException("Sevkiyattaki kolilerden biri artık sevke uygun değil.");
                }

                await connection.ExecuteAsync(@"
                    UPDATE Cartons SET Status = @Status, ShippedAt = @ShippedAt, ShippedBy = @ShippedBy WHERE Id = @Id", new
                {
                    Id = cartonId,
                    Status = CartonStatus.Shipped.ToString(),
                    ShippedAt = shippedAt,
                    ShippedBy = _currentUserService.UserId
                }, transaction);
            }
        }

        await connection.ExecuteAsync(@"
            UPDATE Shipments SET Status = @Status, CompletedAt = @CompletedAt, CompletedBy = @CompletedBy WHERE Id = @Id", new
        {
            request.Id,
            Status = ShipmentStatus.Shipped.ToString(),
            CompletedAt = shippedAt,
            CompletedBy = _currentUserService.UserId
        }, transaction);

        await transaction.CommitAsync(cancellationToken);
        await _auditLogService.LogAsync("Shipments", request.Id, "Complete", null, new { ShipmentNo = (string)shipment!.shipmentno, ItemCount = items.Count });
        return Unit.Value;
    }

    public async Task<Unit> Handle(CancelShipmentCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var shipment = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT Id, ShipmentNo, Status FROM Shipments WHERE Id = @Id FOR UPDATE", new { request.Id }, transaction);
        if (shipment == null)
        {
            throw new KeyNotFoundException("Sevkiyat bulunamadı.");
        }

        var shipmentStatus = (string)shipment.status;
        var isCompletedShipment = shipmentStatus == ShipmentStatus.Shipped.ToString();
        if (shipmentStatus != ShipmentStatus.Draft.ToString() && !isCompletedShipment)
        {
            throw new InvalidOperationException("Yalnızca taslak veya tamamlanmış sevkiyat iptal edilebilir.");
        }
        if (isCompletedShipment && _currentUserService.Role != UserRole.Admin.ToString())
        {
            throw new UnauthorizedAccessException("Tamamlanmış sevkiyatı yalnızca yönetici iptal edebilir.");
        }

        if (isCompletedShipment)
        {
            var items = (await connection.QueryAsync<dynamic>(@"
                SELECT CartonId, PalletId FROM ShipmentItems
                WHERE ShipmentId = @Id AND RemovedAt IS NULL
                ORDER BY ScannedAt FOR UPDATE", new { request.Id }, transaction)).ToList();

            foreach (var item in items)
            {
                if (item.palletid != null)
                {
                    var palletId = (Guid)item.palletid;
                    var palletStatus = await connection.QueryFirstOrDefaultAsync<string>(
                        "SELECT Status FROM Pallets WHERE Id = @Id FOR UPDATE", new { Id = palletId }, transaction);
                    if (palletStatus != PalletStatus.Shipped.ToString())
                    {
                        throw new InvalidOperationException("Sevk iptali yapılamadı: palet durumu beklenen değerle eşleşmiyor.");
                    }

                    var invalidCartons = await connection.ExecuteScalarAsync<int>(@"
                        SELECT COUNT(*) FROM PalletCartons pc JOIN Cartons c ON c.Id = pc.CartonId
                        WHERE pc.PalletId = @Id AND c.Status <> @Status",
                        new { Id = palletId, Status = CartonStatus.Shipped.ToString() }, transaction);
                    if (invalidCartons > 0)
                    {
                        throw new InvalidOperationException("Sevk iptali yapılamadı: palet içindeki koli durumları değişmiş.");
                    }

                    await connection.ExecuteAsync(@"
                        UPDATE Pallets
                        SET Status = CASE WHEN PrintedAt IS NOT NULL THEN @Printed ELSE @Closed END,
                            ShippedAt = NULL, ShippedBy = NULL
                        WHERE Id = @Id;
                        UPDATE Cartons
                        SET Status = @Palletized, ShippedAt = NULL, ShippedBy = NULL
                        WHERE Id IN (SELECT CartonId FROM PalletCartons WHERE PalletId = @Id);", new
                    {
                        Id = palletId,
                        Printed = PalletStatus.Printed.ToString(),
                        Closed = PalletStatus.Closed.ToString(),
                        Palletized = CartonStatus.Palletized.ToString()
                    }, transaction);
                }
                else
                {
                    var cartonId = (Guid)item.cartonid;
                    var cartonStatus = await connection.QueryFirstOrDefaultAsync<string>(
                        "SELECT Status FROM Cartons WHERE Id = @Id FOR UPDATE", new { Id = cartonId }, transaction);
                    if (cartonStatus != CartonStatus.Shipped.ToString())
                    {
                        throw new InvalidOperationException("Sevk iptali yapılamadı: koli durumu beklenen değerle eşleşmiyor.");
                    }

                    await connection.ExecuteAsync(@"
                        UPDATE Cartons
                        SET Status = CASE WHEN PrintedAt IS NOT NULL THEN @Printed ELSE @Closed END,
                            ShippedAt = NULL, ShippedBy = NULL
                        WHERE Id = @Id", new
                    {
                        Id = cartonId,
                        Printed = CartonStatus.Printed.ToString(),
                        Closed = CartonStatus.Closed.ToString()
                    }, transaction);
                }
            }
        }

        var cancelledAt = DateTime.UtcNow;
        await connection.ExecuteAsync(@"
            DELETE FROM ShipmentItems WHERE ShipmentId = @Id;
            UPDATE Shipments SET Status = @Status, CancelledAt = @CancelledAt, CancelledBy = @CancelledBy
            WHERE Id = @Id;", new
        {
            request.Id,
            Status = ShipmentStatus.Cancelled.ToString(),
            CancelledAt = cancelledAt,
            CancelledBy = _currentUserService.UserId
        }, transaction);

        await transaction.CommitAsync(cancellationToken);
        await _auditLogService.LogAsync(
            "Shipments",
            request.Id,
            isCompletedShipment ? "ReverseShipment" : "Cancel",
            new { Status = shipmentStatus },
            new { ShipmentNo = (string)shipment.shipmentno, Status = ShipmentStatus.Cancelled.ToString() });
        return Unit.Value;
    }

    private async Task InsertItem(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid shipmentId,
        Guid? cartonId,
        Guid? palletId)
    {
        await connection.ExecuteAsync(@"
            INSERT INTO ShipmentItems (Id, ShipmentId, CartonId, PalletId, ScannedBy, ScannedAt)
            VALUES (@Id, @ShipmentId, @CartonId, @PalletId, @ScannedBy, @ScannedAt)", new
        {
            Id = Guid.NewGuid(),
            ShipmentId = shipmentId,
            CartonId = cartonId,
            PalletId = palletId,
            ScannedBy = _currentUserService.UserId,
            ScannedAt = DateTime.UtcNow
        }, transaction);
    }

    private static void EnsureDraft(dynamic? shipment)
    {
        if (shipment == null)
        {
            throw new KeyNotFoundException("Sevkiyat bulunamadı.");
        }

        if ((string)shipment.status != ShipmentStatus.Draft.ToString())
        {
            throw new InvalidOperationException("Yalnızca taslak sevkiyat üzerinde işlem yapılabilir.");
        }
    }

    private static ShipmentSummaryDto MapSummary(dynamic row) => new(
        (Guid)row.id,
        (string)row.shipmentno,
        (string)row.status,
        (DateTime)row.createdat,
        (DateTime?)row.completedat,
        Convert.ToInt32(row.palletcount),
        Convert.ToInt32(row.cartoncount),
        Convert.ToInt32(row.productcount));
}
