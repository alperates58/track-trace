using Dapper;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.QrVerification;

public record GetQrRoutingQuery(string RawCode) : IRequest<QrRoutingResult?>;

public record QrRoutingResult(
    Guid ProductCodeId,
    string RawCode,
    string? Gtin,
    string? SerialNo,
    string ProductCodeStatus,
    DateTime? ScannedAt,
    Guid OrderId,
    string OrderNo,
    string? StockCode,
    string? ProductName,
    string CustomerName,
    string OrderStatus,
    Guid? CartonId,
    string? CartonNo,
    string? CartonSscc,
    string? CartonStatus,
    string? StationName,
    int? CartonActualQuantity,
    int? CartonTargetQuantity,
    bool IsAssigned,
    string RoutingStatus,
    string RoutingMessage,
    int CandidateCartonCount);

public sealed class GetQrRoutingQueryHandler : IRequestHandler<GetQrRoutingQuery, QrRoutingResult?>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ICurrentUserService _currentUserService;

    public GetQrRoutingQueryHandler(
        IDbConnectionFactory dbConnectionFactory,
        ICurrentUserService currentUserService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _currentUserService = currentUserService;
    }

    public async Task<QrRoutingResult?> Handle(GetQrRoutingQuery request, CancellationToken cancellationToken)
    {
        var rawCode = request.RawCode.Trim();
        if (string.IsNullOrWhiteSpace(rawCode))
            return null;

        var parsed = Gs1AutoHelper.NormalizeForEncoding(rawCode);
        var normalizedCode = parsed.Success ? parsed.Normalized : rawCode;
        var cleanCode = rawCode.Replace(((char)29).ToString(), string.Empty);

        using var connection = _dbConnectionFactory.CreateConnection();
        const string productSql = """
            SELECT
                pc.Id AS ProductCodeId,
                pc.RawCode,
                pc.Gtin,
                pc.SerialNo,
                pc.Status AS ProductCodeStatus,
                pc.ScannedAt,
                o.Id AS OrderId,
                o.OrderNo,
                o.StockCode,
                o.ProductName,
                o.CustomerName,
                o.Status AS OrderStatus,
                c.Id AS CartonId,
                c.CartonNo,
                c.SSCC AS CartonSscc,
                c.Status AS CartonStatus,
                c.ActualQuantity AS CartonActualQuantity,
                c.TargetQuantity AS CartonTargetQuantity,
                s.Name AS StationName
            FROM ProductCodes pc
            INNER JOIN Orders o ON o.Id = pc.OrderId
            LEFT JOIN Cartons c ON c.Id = pc.CartonId
            LEFT JOIN Stations s ON s.Id = c.StationId
            WHERE pc.RawCode = @NormalizedCode
               OR pc.RawCode = @RawCode
               OR REPLACE(pc.RawCode, CHR(29), '') = @CleanCode
            ORDER BY CASE
                WHEN pc.RawCode = @NormalizedCode THEN 0
                WHEN pc.RawCode = @RawCode THEN 1
                ELSE 2
            END
            LIMIT 1
            """;

        var product = await connection.QueryFirstOrDefaultAsync<QrRoutingRow>(productSql, new
        {
            NormalizedCode = normalizedCode,
            RawCode = rawCode,
            CleanCode = cleanCode
        });

        if (product is null)
            return null;

        if (product.CartonId.HasValue)
        {
            return CreateResult(
                product,
                new TargetCarton(
                    product.CartonId.Value,
                    product.CartonNo!,
                    product.CartonSscc!,
                    product.CartonStatus!,
                    product.StationName,
                    product.CartonActualQuantity ?? 0,
                    product.CartonTargetQuantity ?? 0),
                true,
                "Assigned",
                $"Ürün {product.CartonNo} kolisine atanmış.",
                1);
        }

        var userTargets = await FindTargetsAsync(
            connection,
            product.OrderId,
            "c.Status = 'Filling' AND c.AssignedUserId = @UserId",
            new { product.OrderId, UserId = _currentUserService.UserId });

        if (userTargets.Count == 1)
        {
            return CreateResult(
                product,
                userTargets[0],
                false,
                "ActiveTarget",
                $"Ürün henüz atanmadı; mevcut oturum için aktif hedef {userTargets[0].CartonNo} kolisidir.",
                1);
        }

        if (userTargets.Count > 1)
        {
            return CreateResult(
                product,
                null,
                false,
                "Ambiguous",
                "Bu sipariş için birden fazla aktif koli var. Kesin hedef için okutma istasyonunu kontrol edin.",
                userTargets.Count);
        }

        var openTargets = await FindTargetsAsync(
            connection,
            product.OrderId,
            "c.Status = 'Open'",
            new { product.OrderId, UserId = _currentUserService.UserId });

        if (openTargets.Count == 1)
        {
            return CreateResult(
                product,
                openTargets[0],
                false,
                "ActiveTarget",
                $"Ürün henüz atanmadı; siparişin tek açık hedefi {openTargets[0].CartonNo} kolisidir.",
                1);
        }

        if (openTargets.Count > 1)
        {
            return CreateResult(
                product,
                null,
                false,
                "Ambiguous",
                "Sipariş birden fazla istasyonda açık. Kesin hedef koli okutma istasyonuna göre belirlenir.",
                openTargets.Count);
        }

        return CreateResult(
            product,
            null,
            false,
            "AwaitingCarton",
            "Ürün siparişe kayıtlı ancak henüz aktif bir koliye atanmadı. Önce ilgili okutma ekranında koli açılmalıdır.",
            0);
    }

    private static async Task<List<TargetCarton>> FindTargetsAsync(
        global::System.Data.IDbConnection connection,
        Guid orderId,
        string condition,
        object parameters)
    {
        var sql = $"""
            SELECT
                c.Id,
                c.CartonNo,
                c.SSCC AS CartonSscc,
                c.Status,
                s.Name AS StationName,
                c.ActualQuantity,
                c.TargetQuantity
            FROM Cartons c
            LEFT JOIN Stations s ON s.Id = c.StationId
            WHERE c.OrderId = @OrderId AND {condition}
            ORDER BY COALESCE(c.OpenedAt, c.CreatedAt) DESC, c.CartonNo DESC
            LIMIT 3
            """;

        return (await connection.QueryAsync<TargetCarton>(sql, parameters)).ToList();
    }

    private static QrRoutingResult CreateResult(
        QrRoutingRow product,
        TargetCarton? target,
        bool isAssigned,
        string routingStatus,
        string routingMessage,
        int candidateCartonCount)
    {
        return new QrRoutingResult(
            product.ProductCodeId,
            product.RawCode,
            product.Gtin,
            product.SerialNo,
            product.ProductCodeStatus,
            product.ScannedAt,
            product.OrderId,
            product.OrderNo,
            product.StockCode,
            product.ProductName,
            product.CustomerName,
            product.OrderStatus,
            target?.Id,
            target?.CartonNo,
            target?.CartonSscc,
            target?.Status,
            target?.StationName,
            target?.ActualQuantity,
            target?.TargetQuantity,
            isAssigned,
            routingStatus,
            routingMessage,
            candidateCartonCount);
    }

    private sealed class QrRoutingRow
    {
        public Guid ProductCodeId { get; init; }
        public string RawCode { get; init; } = string.Empty;
        public string? Gtin { get; init; }
        public string? SerialNo { get; init; }
        public string ProductCodeStatus { get; init; } = string.Empty;
        public DateTime? ScannedAt { get; init; }
        public Guid OrderId { get; init; }
        public string OrderNo { get; init; } = string.Empty;
        public string? StockCode { get; init; }
        public string? ProductName { get; init; }
        public string CustomerName { get; init; } = string.Empty;
        public string OrderStatus { get; init; } = string.Empty;
        public Guid? CartonId { get; init; }
        public string? CartonNo { get; init; }
        public string? CartonSscc { get; init; }
        public string? CartonStatus { get; init; }
        public string? StationName { get; init; }
        public int? CartonActualQuantity { get; init; }
        public int? CartonTargetQuantity { get; init; }
    }

    private sealed record TargetCarton(
        Guid Id,
        string CartonNo,
        string CartonSscc,
        string Status,
        string? StationName,
        int ActualQuantity,
        int TargetQuantity);
}
