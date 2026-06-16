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

namespace TrackTrace.Application.Features.Orders;

public record GetOrdersQuery(int PageNumber = 1, int PageSize = 10, string? Search = null, string? Status = null) 
    : IRequest<(IEnumerable<OrderDto> Items, int TotalCount)>;

public record GetOrderByIdQuery(Guid Id) : IRequest<OrderDto>;

public record CreateOrderCommand(CreateOrderRequest Request) : IRequest<Guid>;

public record UpdateOrderCommand(Guid Id, UpdateOrderRequest Request) : IRequest<Unit>;

public record ActivateOrderCommand(Guid Id) : IRequest<Unit>;

public record CompleteOrderCommand(Guid Id) : IRequest<Unit>;

public record CancelOrderCommand(Guid Id) : IRequest<Unit>;

#region Validators

public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.Request.OrderNo).NotEmpty().WithMessage("Sipariş numarası boş olamaz.");
        RuleFor(x => x.Request.CustomerName).NotEmpty().WithMessage("Müşteri adı boş olamaz.");
        RuleFor(x => x.Request.GTIN).NotEmpty().Length(14).WithMessage("GTIN 14 haneli olmalıdır.");
        RuleFor(x => x.Request.ProductPerCarton).GreaterThan(0).WithMessage("Koli içi ürün sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.CartonPerPallet).GreaterThan(0).WithMessage("Palet içi koli sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.ExpectedQuantity).GreaterThan(0).WithMessage("Beklenen miktar 0'dan büyük olmalıdır.");
    }
}

public class UpdateOrderCommandValidator : AbstractValidator<UpdateOrderCommand>
{
    public UpdateOrderCommandValidator()
    {
        RuleFor(x => x.Request.CustomerName).NotEmpty().WithMessage("Müşteri adı boş olamaz.");
        RuleFor(x => x.Request.GTIN).NotEmpty().Length(14).WithMessage("GTIN 14 haneli olmalıdır.");
        RuleFor(x => x.Request.ProductPerCarton).GreaterThan(0).WithMessage("Koli içi ürün sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.CartonPerPallet).GreaterThan(0).WithMessage("Palet içi koli sayısı 0'dan büyük olmalıdır.");
        RuleFor(x => x.Request.ExpectedQuantity).GreaterThan(0).WithMessage("Beklenen miktar 0'dan büyük olmalıdır.");
    }
}

#endregion

#region Handlers

public class OrderHandlers : 
    IRequestHandler<GetOrdersQuery, (IEnumerable<OrderDto> Items, int TotalCount)>,
    IRequestHandler<GetOrderByIdQuery, OrderDto>,
    IRequestHandler<CreateOrderCommand, Guid>,
    IRequestHandler<UpdateOrderCommand, Unit>,
    IRequestHandler<ActivateOrderCommand, Unit>,
    IRequestHandler<CompleteOrderCommand, Unit>,
    IRequestHandler<CancelOrderCommand, Unit>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IAuditLogService _auditLogService;

    public OrderHandlers(IDbConnectionFactory dbConnectionFactory, IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _auditLogService = auditLogService;
    }

    public async Task<(IEnumerable<OrderDto> Items, int TotalCount)> Handle(GetOrdersQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var builder = new SqlBuilder();
        
        var selector = builder.AddTemplate(@"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o
            /**where**/
            ORDER BY o.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset", new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });

        var countTemplate = builder.AddTemplate("SELECT COUNT(*) FROM Orders o /**where**/");

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            builder.Where("(o.OrderNo ILIKE @Search OR o.CustomerName ILIKE @Search OR o.ProductName ILIKE @Search OR o.StockCode ILIKE @Search)", 
                new { Search = $"%{request.Search}%" });
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            builder.Where("o.Status = @Status", new { Status = request.Status });
        }

        var items = await connection.QueryAsync<dynamic>(selector.RawSql, selector.Parameters);
        var totalCount = await connection.ExecuteScalarAsync<int>(countTemplate.RawSql, countTemplate.Parameters);

        var orderDtos = items.Select(x => new OrderDto(
            (Guid)x.id,
            (string)x.orderno,
            (string)x.customername,
            (string?)x.stockcode,
            (string?)x.productname,
            (string)x.gtin,
            (int)x.productpercarton,
            (int)x.cartonperpallet,
            (int)x.expectedquantity,
            (string?)x.description,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime)x.updatedat,
            Convert.ToInt32(x.ScannedCount)
        ));

        return (orderDtos, totalCount);
    }

    public async Task<OrderDto> Handle(GetOrderByIdQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o
            WHERE o.Id = @Id";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { Id = request.Id });
        if (x == null)
        {
            throw new KeyNotFoundException("Sipariş bulunamadı.");
        }

        return new OrderDto(
            (Guid)x.id,
            (string)x.orderno,
            (string)x.customername,
            (string?)x.stockcode,
            (string?)x.productname,
            (string)x.gtin,
            (int)x.productpercarton,
            (int)x.cartonperpallet,
            (int)x.expectedquantity,
            (string?)x.description,
            (string)x.status,
            (DateTime)x.createdat,
            (DateTime)x.updatedat,
            Convert.ToInt32(x.ScannedCount)
        );
    }

    public async Task<Guid> Handle(CreateOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var id = Guid.NewGuid();
        const string sql = @"
            INSERT INTO Orders (Id, OrderNo, CustomerName, StockCode, ProductName, GTIN, ProductPerCarton, CartonPerPallet, ExpectedQuantity, Description, Status, CreatedAt, UpdatedAt)
            VALUES (@Id, @OrderNo, @CustomerName, @StockCode, @ProductName, @GTIN, @ProductPerCarton, @CartonPerPallet, @ExpectedQuantity, @Description, @Status, @CreatedAt, @UpdatedAt)";

        var req = request.Request;
        var parameters = new
        {
            Id = id,
            OrderNo = req.OrderNo,
            CustomerName = req.CustomerName,
            StockCode = req.StockCode,
            ProductName = req.ProductName,
            GTIN = req.GTIN,
            ProductPerCarton = req.ProductPerCarton,
            CartonPerPallet = req.CartonPerPallet,
            ExpectedQuantity = req.ExpectedQuantity,
            Description = req.Description,
            Status = OrderStatus.Draft.ToString(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await connection.ExecuteAsync(sql, parameters);
        await _auditLogService.LogAsync("Orders", id, "Create", null, parameters);
        return id;
    }

    public async Task<Unit> Handle(UpdateOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        // Check current status
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");
        if (existing.status != OrderStatus.Draft.ToString())
        {
            throw new InvalidOperationException("Sadece taslak durumundaki siparişler güncellenebilir.");
        }

        const string sql = @"
            UPDATE Orders 
            SET CustomerName = @CustomerName, StockCode = @StockCode, ProductName = @ProductName, GTIN = @GTIN, 
                ProductPerCarton = @ProductPerCarton, CartonPerPallet = @CartonPerPallet, ExpectedQuantity = @ExpectedQuantity, 
                Description = @Description, UpdatedAt = @UpdatedAt
            WHERE Id = @Id";

        var req = request.Request;
        var parameters = new
        {
            Id = request.Id,
            CustomerName = req.CustomerName,
            StockCode = req.StockCode,
            ProductName = req.ProductName,
            GTIN = req.GTIN,
            ProductPerCarton = req.ProductPerCarton,
            CartonPerPallet = req.CartonPerPallet,
            ExpectedQuantity = req.ExpectedQuantity,
            Description = req.Description,
            UpdatedAt = DateTime.UtcNow
        };

        await connection.ExecuteAsync(sql, parameters);
        await _auditLogService.LogAsync("Orders", request.Id, "Update", existing, parameters);
        return Unit.Value;
    }

    public async Task<Unit> Handle(ActivateOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");
        
        if (existing.status != OrderStatus.Draft.ToString())
        {
            throw new InvalidOperationException("Yalnızca taslak durumundaki siparişler aktifleştirilebilir.");
        }

        const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id, Status = OrderStatus.Active.ToString(), UpdatedAt = DateTime.UtcNow });
        await _auditLogService.LogAsync("Orders", request.Id, "Activate");
        return Unit.Value;
    }

    public async Task<Unit> Handle(CompleteOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");

        if (existing.status != OrderStatus.Active.ToString())
        {
            throw new InvalidOperationException("Yalnızca aktif durumundaki siparişler tamamlanabilir.");
        }

        const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id, Status = OrderStatus.Completed.ToString(), UpdatedAt = DateTime.UtcNow });
        await _auditLogService.LogAsync("Orders", request.Id, "Complete");
        return Unit.Value;
    }

    public async Task<Unit> Handle(CancelOrderCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var existing = await connection.QueryFirstOrDefaultAsync<dynamic>("SELECT Status FROM Orders WHERE Id = @Id", new { Id = request.Id });
        if (existing == null) throw new KeyNotFoundException("Sipariş bulunamadı.");

        if (existing.status == OrderStatus.Completed.ToString() || existing.status == OrderStatus.Cancelled.ToString())
        {
            throw new InvalidOperationException("Tamamlanmış veya iptal edilmiş siparişler tekrar iptal edilemez.");
        }

        const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
        await connection.ExecuteAsync(sql, new { Id = request.Id, Status = OrderStatus.Cancelled.ToString(), UpdatedAt = DateTime.UtcNow });
        await _auditLogService.LogAsync("Orders", request.Id, "Cancel");
        return Unit.Value;
    }
}

#endregion
