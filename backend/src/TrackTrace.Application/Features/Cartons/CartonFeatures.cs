using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using FluentValidation;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Cartons;

public record GetCartonsQuery(int PageNumber = 1, int PageSize = 10, string? Search = null, string? Status = null, Guid? OrderId = null) 
    : IRequest<(IEnumerable<CartonDto> Items, int TotalCount)>;

public record GetCartonByIdQuery(Guid Id) : IRequest<CartonDto>;

public record GetCartonItemsQuery(Guid Id) : IRequest<IEnumerable<BarcodeSearchResultDto>>;

public record PrintCartonLabelCommand(Guid Id, string Format) : IRequest<(byte[]? FileContent, string? ZplText)>;

public class CartonHandlers :
    IRequestHandler<GetCartonsQuery, (IEnumerable<CartonDto> Items, int TotalCount)>,
    IRequestHandler<GetCartonByIdQuery, CartonDto>,
    IRequestHandler<GetCartonItemsQuery, IEnumerable<BarcodeSearchResultDto>>,
    IRequestHandler<PrintCartonLabelCommand, (byte[]? FileContent, string? ZplText)>
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
}
