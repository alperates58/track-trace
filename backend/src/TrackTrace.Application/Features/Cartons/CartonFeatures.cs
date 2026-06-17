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

namespace TrackTrace.Application.Features.Cartons;

public record GetCartonsQuery(int PageNumber = 1, int PageSize = 10, string? Search = null, string? Status = null, Guid? OrderId = null, Guid? PalletId = null) 
    : IRequest<(IEnumerable<CartonDto> Items, int TotalCount)>;

public record GetCartonByIdQuery(Guid Id) : IRequest<CartonDto>;

public record GetCartonItemsQuery(Guid Id) : IRequest<IEnumerable<BarcodeSearchResultDto>>;

public record PrintCartonLabelCommand(Guid Id, string Format) : IRequest<(byte[]? FileContent, string? ZplText)>;

public record DecomposeCartonCommand(Guid Id) : IRequest<Unit>;

public record RemoveProductFromCartonCommand(Guid CartonId, string RawCode) : IRequest<Unit>;

public record AddProductToCartonCommand(Guid CartonId, string RawCode) : IRequest<Unit>;

public class CartonHandlers :
    IRequestHandler<GetCartonsQuery, (IEnumerable<CartonDto> Items, int TotalCount)>,
    IRequestHandler<GetCartonByIdQuery, CartonDto>,
    IRequestHandler<GetCartonItemsQuery, IEnumerable<BarcodeSearchResultDto>>,
    IRequestHandler<PrintCartonLabelCommand, (byte[]? FileContent, string? ZplText)>,
    IRequestHandler<DecomposeCartonCommand, Unit>,
    IRequestHandler<RemoveProductFromCartonCommand, Unit>,
    IRequestHandler<AddProductToCartonCommand, Unit>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAuditLogService _auditLogService;
    private readonly ILabelGenerator _labelGenerator;

    public CartonHandlers(
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

    public async Task<(IEnumerable<CartonDto> Items, int TotalCount)> Handle(GetCartonsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var builder = new SqlBuilder();
        
        var selector = builder.AddTemplate(@"
            SELECT c.*, o.OrderNo
            FROM Cartons c
            INNER JOIN Orders o ON c.OrderId = o.Id
            /**where**/
            ORDER BY c.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset", new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });

        var countTemplate = builder.AddTemplate(@"
            SELECT COUNT(*) 
            FROM Cartons c
            INNER JOIN Orders o ON c.OrderId = o.Id
            /**where**/");

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            builder.Where("(c.CartonNo ILIKE @Search OR c.SSCC ILIKE @Search OR o.OrderNo ILIKE @Search)", 
                new { Search = $"%{request.Search}%" });
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            builder.Where("c.Status = @Status", new { Status = request.Status });
        }

        if (request.OrderId.HasValue)
        {
            builder.Where("c.OrderId = @OrderId", new { OrderId = request.OrderId.Value });
        }

        if (request.PalletId.HasValue)
        {
            builder.Where("c.Id IN (SELECT CartonId FROM PalletCartons WHERE PalletId = @PalletId)", new { PalletId = request.PalletId.Value });
        }

        var items = await connection.QueryAsync<dynamic>(selector.RawSql, selector.Parameters);
        var totalCount = await connection.ExecuteScalarAsync<int>(countTemplate.RawSql, countTemplate.Parameters);

        var cartonDtos = items.Select(x => new CartonDto(
            (Guid)x.id,
            (Guid)x.orderid,
            (string)x.orderno,
            (string)x.cartonno,
            (string)x.sscc,
            (int)x.targetquantity,
            (int)x.actualquantity,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime?)x.closedat,
            (DateTime?)x.printedat
        ));

        return (cartonDtos, totalCount);
    }

    public async Task<CartonDto> Handle(GetCartonByIdQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT c.*, o.OrderNo
            FROM Cartons c
            INNER JOIN Orders o ON c.OrderId = o.Id
            WHERE c.Id = @Id";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { Id = request.Id });
        if (x == null)
        {
            throw new KeyNotFoundException("Koli bulunamadı.");
        }

        return new CartonDto(
            (Guid)x.id,
            (Guid)x.orderid,
            (string)x.orderno,
            (string)x.cartonno,
            (string)x.sscc,
            (int)x.targetquantity,
            (int)x.actualquantity,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime?)x.closedat,
            (DateTime?)x.printedat
        );
    }

    public async Task<IEnumerable<BarcodeSearchResultDto>> Handle(GetCartonItemsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT pc.RawCode, pc.Gtin, pc.SerialNo, pc.Status, pc.ScannedAt, u.Name as ScannedBy,
                   o.OrderNo, o.CustomerName, o.ProductName, 
                   c.CartonNo, c.SSCC as CartonSSCC
            FROM ProductCodes pc
            INNER JOIN Orders o ON pc.OrderId = o.Id
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            WHERE pc.CartonId = @Id
            ORDER BY pc.ScannedAt DESC";

        var items = await connection.QueryAsync<dynamic>(sql, new { Id = request.Id });
        
        return items.Select(x => new BarcodeSearchResultDto(
            (string)x.rawcode,
            (string?)x.gtin,
            (string?)x.serialno,
            (string)x.status,
            (DateTime?)x.scannedat,
            (string?)x.scannedby,
            (string?)x.orderno,
            (string?)x.customername,
            (string?)x.productname,
            (string?)x.cartonno,
            (string?)x.cartonsscc,
            null,
            null
        ));
    }

    public async Task<(byte[]? FileContent, string? ZplText)> Handle(PrintCartonLabelCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        // Load carton
        var cartonDto = await Handle(new GetCartonByIdQuery(request.Id), cancellationToken);
        
        // Load order
        const string orderSql = @"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o WHERE o.Id = @OrderId";
        var orderRaw = await connection.QueryFirstOrDefaultAsync<dynamic>(orderSql, new { OrderId = cartonDto.OrderId });
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
            pdfData = _labelGenerator.GenerateCartonPdfLabel(cartonDto, orderDto);
        }
        else
        {
            zplData = _labelGenerator.GenerateCartonZplLabel(cartonDto, orderDto);
        }

        // Record print job
        var printJobId = Guid.NewGuid();
        const string printJobSql = @"
            INSERT INTO PrintJobs (Id, LabelType, EntityId, PrintedBy, PrintCount, Format, CreatedAt)
            VALUES (@Id, @LabelType, @EntityId, @PrintedBy, 1, @Format, @CreatedAt)";

        await connection.ExecuteAsync(printJobSql, new
        {
            Id = printJobId,
            LabelType = "Carton",
            EntityId = request.Id,
            PrintedBy = _currentUserService.UserId,
            Format = request.Format.ToUpper(),
            CreatedAt = DateTime.UtcNow
        });

        // Update Carton Status to Printed if not already Palletized
        if (cartonDto.Status != CartonStatus.Palletized.ToString())
        {
            await connection.ExecuteAsync(
                "UPDATE Cartons SET Status = @Status, PrintedAt = @PrintedAt WHERE Id = @Id",
                new { Id = request.Id, Status = CartonStatus.Printed.ToString(), PrintedAt = DateTime.UtcNow });
        }

        await _auditLogService.LogAsync("Cartons", request.Id, "PrintLabel", null, new { Format = request.Format });

        return (pdfData, zplData);
    }

    public async Task<Unit> Handle(DecomposeCartonCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != ConnectionState.Open) connection.Open();

        using var transaction = connection.BeginTransaction();
        try
         {
            // 1. Get carton info for audit log
            var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM Cartons WHERE Id = @Id FOR UPDATE", new { Id = request.Id }, transaction);
            if (carton == null) throw new KeyNotFoundException("Koli bulunamadı.");

            string cartonNo = carton.cartonno;
            string sscc = carton.sscc;

            // 2. Revert products back to 'Uploaded'
            const string updateProductsSql = @"
                UPDATE ProductCodes 
                SET CartonId = NULL, Status = @Status, ScannedAt = NULL, ScannedBy = NULL 
                WHERE CartonId = @CartonId";

            await connection.ExecuteAsync(updateProductsSql, new
            {
                CartonId = request.Id,
                Status = ProductCodeStatus.Uploaded.ToString()
            }, transaction);

            // 3. Delete carton (cascade will delete PalletCartons)
            await connection.ExecuteAsync("DELETE FROM Cartons WHERE Id = @Id", new { Id = request.Id }, transaction);

            transaction.Commit();

            await _auditLogService.LogAsync("Cartons", request.Id, "Decompose", null, new { CartonNo = cartonNo, SSCC = sscc });
            return Unit.Value;
        }
        catch (Exception)
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Unit> Handle(RemoveProductFromCartonCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != ConnectionState.Open) connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            // 1. Get Product Code
            var parsed = Gs1AutoHelper.NormalizeForEncoding(request.RawCode);
            string searchCode = parsed.Success ? parsed.Normalized : request.RawCode;

            var pc = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM ProductCodes WHERE RawCode = @RawCode AND CartonId = @CartonId FOR UPDATE",
                new { RawCode = searchCode, CartonId = request.CartonId }, transaction);
            
            if (pc == null)
            {
                throw new KeyNotFoundException("Ürün bu kolide bulunamadı.");
            }

            // 2. Get Carton
            var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM Cartons WHERE Id = @Id FOR UPDATE", new { Id = request.CartonId }, transaction);
            if (carton == null) throw new KeyNotFoundException("Koli bulunamadı.");

            string cartonNo = carton.cartonno;
            string sscc = carton.sscc;
            int actualQty = carton.actualquantity;

            // 3. Update product status back to Uploaded
            await connection.ExecuteAsync(@"
                UPDATE ProductCodes 
                SET CartonId = NULL, Status = @Status, ScannedAt = NULL, ScannedBy = NULL 
                WHERE Id = @Id",
                new { Id = (Guid)pc.id, Status = ProductCodeStatus.Uploaded.ToString() }, transaction);

            // 4. Update carton
            actualQty = Math.Max(0, actualQty - 1);
            await connection.ExecuteAsync(@"
                UPDATE Cartons 
                SET ActualQuantity = @ActualQuantity, Status = @Status, ClosedAt = NULL 
                WHERE Id = @Id",
                new { Id = request.CartonId, ActualQuantity = actualQty, Status = CartonStatus.Open.ToString() }, transaction);

            // 5. Remove carton from Pallet (since it is no longer closed/complete)
            await connection.ExecuteAsync("DELETE FROM PalletCartons WHERE CartonId = @CartonId", new { CartonId = request.CartonId }, transaction);

            transaction.Commit();

            await _auditLogService.LogAsync("Cartons", request.CartonId, "RemoveProduct", null, new { RawCode = searchCode, CartonNo = cartonNo, NewQuantity = actualQty });
            return Unit.Value;
        }
        catch (Exception)
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Unit> Handle(AddProductToCartonCommand request, CancellationToken cancellationToken)
    {
        using var connection = (NpgsqlConnection)_dbConnectionFactory.CreateConnection();
        if (connection.State != ConnectionState.Open) connection.Open();

        using var transaction = connection.BeginTransaction();
        try
        {
            // 1. Get Carton
            var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM Cartons WHERE Id = @Id FOR UPDATE", new { Id = request.CartonId }, transaction);
            if (carton == null) throw new KeyNotFoundException("Koli bulunamadı.");
            
            if (carton.status != CartonStatus.Open.ToString())
            {
                throw new InvalidOperationException("Yalnızca açık kolilere ürün eklenebilir.");
            }

            string cartonNo = carton.cartonno;
            string sscc = carton.sscc;
            int actualQty = carton.actualquantity;
            int targetQty = carton.targetquantity;
            Guid orderId = carton.orderid;

            // 2. Get Product Code
            var parsed = Gs1AutoHelper.NormalizeForEncoding(request.RawCode);
            string searchCode = parsed.Success ? parsed.Normalized : request.RawCode;

            var pc = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT * FROM ProductCodes WHERE RawCode = @RawCode FOR UPDATE",
                new { RawCode = searchCode }, transaction);
            
            if (pc == null)
            {
                throw new KeyNotFoundException("Sistemde kayıtlı olmayan ürün barkodu.");
            }

            if (pc.orderid != orderId)
            {
                throw new InvalidOperationException("Bu barkod bu koli siparişine ait değil.");
            }

            if (pc.status != ProductCodeStatus.Uploaded.ToString())
            {
                throw new InvalidOperationException("Bu ürün barkodu daha önce okutulmuş.");
            }

            // 3. Update Product Code
            await connection.ExecuteAsync(@"
                UPDATE ProductCodes 
                SET CartonId = @CartonId, Status = @Status, ScannedAt = @ScannedAt, ScannedBy = @ScannedBy 
                WHERE Id = @Id",
                new
                {
                    Id = (Guid)pc.id,
                    CartonId = request.CartonId,
                    Status = ProductCodeStatus.Scanned.ToString(),
                    ScannedAt = DateTime.UtcNow,
                    ScannedBy = _currentUserService.UserId
                }, transaction);

            // 4. Update Carton
            actualQty++;
            string cartonStatus = CartonStatus.Open.ToString();
            DateTime? closedAt = null;
            if (actualQty >= targetQty)
            {
                cartonStatus = CartonStatus.Closed.ToString();
                closedAt = DateTime.UtcNow;
            }

            await connection.ExecuteAsync(@"
                UPDATE Cartons 
                SET ActualQuantity = @ActualQuantity, Status = @Status, ClosedAt = @ClosedAt 
                WHERE Id = @Id",
                new
                {
                    Id = request.CartonId,
                    ActualQuantity = actualQty,
                    Status = cartonStatus,
                    ClosedAt = closedAt
                }, transaction);

            transaction.Commit();

            await _auditLogService.LogAsync("Cartons", request.CartonId, "AddProduct", null, new { RawCode = searchCode, CartonNo = cartonNo, NewQuantity = actualQty, Closed = closedAt != null });
            return Unit.Value;
        }
        catch (Exception)
        {
            transaction.Rollback();
            throw;
        }
    }
}
