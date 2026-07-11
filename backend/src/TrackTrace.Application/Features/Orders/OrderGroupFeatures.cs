using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Application.Common;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Orders;

public record OrderGroupSummaryDto(
    string GroupKey,
    string OrderNo,
    string CustomerName,
    int LineCount,
    int DistinctWorkOrderCount,
    int TotalExpectedQuantity,
    int TotalScannedQuantity,
    decimal ProgressPercentage,
    string StatusSummary,
    DateTime LastActivityAt
);

public record GetOrderGroupsQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? Search = null,
    string? Status = null
) : IRequest<(IEnumerable<OrderGroupSummaryDto> Items, int TotalCount, OrderGroupGlobalKpiDto Kpis)>;

public record OrderGroupGlobalKpiDto(
    int TotalOrderGroups,
    int OpenOrderGroups,
    int CompletedOrderGroups,
    decimal OverallProgressPercentage
);

public record GetOrderGroupLinesQuery(
    string GroupKey,
    int PageNumber = 1,
    int PageSize = 50,
    string? Search = null,
    string? Status = null,
    string? SortBy = null,
    string? SortDirection = "ASC"
) : IRequest<(IEnumerable<OrderDto> Items, int TotalCount)>;

public record GetOrderGroupSummaryQuery(string GroupKey) : IRequest<OrderGroupSummaryDto>;

public class OrderGroupHandlers : 
    IRequestHandler<GetOrderGroupsQuery, (IEnumerable<OrderGroupSummaryDto> Items, int TotalCount, OrderGroupGlobalKpiDto Kpis)>,
    IRequestHandler<GetOrderGroupLinesQuery, (IEnumerable<OrderDto> Items, int TotalCount)>,
    IRequestHandler<GetOrderGroupSummaryQuery, OrderGroupSummaryDto>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public OrderGroupHandlers(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<(IEnumerable<OrderGroupSummaryDto> Items, int TotalCount, OrderGroupGlobalKpiDto Kpis)> Handle(GetOrderGroupsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var builder = new SqlBuilder();

        // Phase 1: Determine matching groups based on search
        string groupFilter = "";
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            groupFilter = @"
                AND EXISTS (
                    SELECT 1 FROM Orders match_o
                    WHERE match_o.OrderNo = o.OrderNo AND match_o.CustomerName = o.CustomerName
                    AND (match_o.OrderNo ILIKE @Search 
                         OR match_o.CustomerName ILIKE @Search 
                         OR match_o.ProductName ILIKE @Search 
                         OR match_o.StockCode ILIKE @Search 
                         OR match_o.GTIN ILIKE @Search)
                )";
            builder.AddParameters(new { Search = $"%{request.Search}%" });
        }

        // We apply group level status filtering after aggregation if needed, or by checking line statuses.
        // If Status is provided, we filter groups where ANY line has that status, or ALL lines?
        // Usually, if they filter by "Aktif", we check if there's any active line.
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            groupFilter += @"
                AND EXISTS (
                    SELECT 1 FROM Orders stat_o
                    WHERE stat_o.OrderNo = o.OrderNo AND stat_o.CustomerName = o.CustomerName
                    AND stat_o.Status = @Status
                )";
            builder.AddParameters(new { Status = request.Status });
        }

        // Global KPIs - computed on the filtered groups
        var kpiSql = $@"
            WITH FilteredGroups AS (
                SELECT o.OrderNo, o.CustomerName,
                       SUM(o.ExpectedQuantity) as TotalExpected,
                       SUM(COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0)) as TotalScanned
                FROM Orders o
                WHERE 1=1 {groupFilter}
                GROUP BY o.OrderNo, o.CustomerName
            )
            SELECT 
                COUNT(*) as TotalOrderGroups,
                SUM(CASE WHEN TotalScanned < TotalExpected THEN 1 ELSE 0 END) as OpenOrderGroups,
                SUM(CASE WHEN TotalScanned >= TotalExpected AND TotalExpected > 0 THEN 1 ELSE 0 END) as CompletedOrderGroups,
                COALESCE(SUM(TotalScanned), 0) as GlobalScanned,
                COALESCE(SUM(TotalExpected), 0) as GlobalExpected
            FROM FilteredGroups";

        var kpiResult = await connection.QueryFirstOrDefaultAsync<dynamic>(kpiSql, builder.Parameters);
        
        long globalScanned = kpiResult?.globalscanned ?? 0;
        long globalExpected = kpiResult?.globalexpected ?? 0;
        decimal overallProgress = globalExpected > 0 ? Math.Round((decimal)globalScanned / globalExpected * 100, 1) : 0m;

        var kpis = new OrderGroupGlobalKpiDto(
            Convert.ToInt32(kpiResult?.totalordergroups ?? 0),
            Convert.ToInt32(kpiResult?.openordergroups ?? 0),
            Convert.ToInt32(kpiResult?.completedordergroups ?? 0),
            overallProgress
        );

        // Paginated Data
        var selectorSql = $@"
            SELECT 
                o.OrderNo, 
                o.CustomerName,
                COUNT(o.Id) as LineCount,
                COUNT(DISTINCT o.GTIN) as DistinctWorkOrderCount,
                SUM(o.ExpectedQuantity) as TotalExpectedQuantity,
                SUM(COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0)) as TotalScannedQuantity,
                MAX(o.UpdatedAt) as LastActivityAt,
                STRING_AGG(DISTINCT o.Status, ',') as Statuses
            FROM Orders o
            WHERE 1=1 {groupFilter}
            GROUP BY o.OrderNo, o.CustomerName
            ORDER BY MAX(o.CreatedAt) DESC
            LIMIT @Limit OFFSET @Offset";

        builder.AddParameters(new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });

        var items = await connection.QueryAsync<dynamic>(selectorSql, builder.Parameters);

        var dtos = items.Select(x => {
            string orderNo = x.orderno;
            string customerName = x.customername;
            int totalExpected = Convert.ToInt32(x.totalexpectedquantity);
            int totalScanned = Convert.ToInt32(x.totalscannedquantity);
            decimal progress = totalExpected > 0 ? Math.Round((decimal)totalScanned / totalExpected * 100, 1) : 0m;
            
            string statusSummary = "Aktif";
            if (totalExpected > 0 && totalScanned >= totalExpected) {
                statusSummary = "Tamamlandı";
            }

            return new OrderGroupSummaryDto(
                OrderGroupKeyHelper.CreateGroupKey(orderNo, customerName),
                orderNo,
                customerName,
                Convert.ToInt32(x.linecount),
                Convert.ToInt32(x.distinctworkordercount),
                totalExpected,
                totalScanned,
                progress,
                statusSummary,
                (DateTime)x.lastactivityat
            );
        }).ToList();

        return (dtos, kpis.TotalOrderGroups, kpis);
    }

    public async Task<(IEnumerable<OrderDto> Items, int TotalCount)> Handle(GetOrderGroupLinesQuery request, CancellationToken cancellationToken)
    {
        var payload = OrderGroupKeyHelper.DecodeGroupKey(request.GroupKey);
        
        using var connection = _dbConnectionFactory.CreateConnection();
        var builder = new SqlBuilder();
        
        var selector = builder.AddTemplate(@$"
            SELECT o.*, 
                   COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0) as ScannedCount
            FROM Orders o
            /**where**/
            /**orderby**/
            LIMIT @Limit OFFSET @Offset", new { Limit = Math.Min(request.PageSize, 100), Offset = (request.PageNumber - 1) * request.PageSize });

        var countTemplate = builder.AddTemplate("SELECT COUNT(*) FROM Orders o /**where**/");

        builder.Where("o.OrderNo = @OrderNo AND o.CustomerName = @CustomerName", new { OrderNo = payload.OrderNo, CustomerName = payload.CustomerName });

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            builder.Where("(o.ProductName ILIKE @Search OR o.StockCode ILIKE @Search OR o.GTIN ILIKE @Search)", 
                new { Search = $"%{request.Search}%" });
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            builder.Where("o.Status = @Status", new { Status = request.Status });
        }

        var sortFields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "stockCode", "o.StockCode" },
            { "productName", "o.ProductName" },
            { "gtin", "o.GTIN" },
            { "expectedQuantity", "o.ExpectedQuantity" },
            { "status", "o.Status" },
            { "createdAt", "o.CreatedAt" }
        };

        var sortDir = request.SortDirection?.ToUpper() == "DESC" ? "DESC" : "ASC";
        if (!string.IsNullOrWhiteSpace(request.SortBy) && sortFields.TryGetValue(request.SortBy, out var dbField))
        {
            builder.OrderBy($"{dbField} {sortDir}");
        }
        else
        {
            builder.OrderBy($"o.CreatedAt {sortDir}");
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

    public async Task<OrderGroupSummaryDto> Handle(GetOrderGroupSummaryQuery request, CancellationToken cancellationToken)
    {
        var payload = OrderGroupKeyHelper.DecodeGroupKey(request.GroupKey);
        
        using var connection = _dbConnectionFactory.CreateConnection();
        var sql = @"
            SELECT 
                o.OrderNo, 
                o.CustomerName,
                COUNT(o.Id) as LineCount,
                COUNT(DISTINCT o.GTIN) as DistinctWorkOrderCount,
                SUM(o.ExpectedQuantity) as TotalExpectedQuantity,
                SUM(COALESCE((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned'), 0)) as TotalScannedQuantity,
                MAX(o.UpdatedAt) as LastActivityAt,
                STRING_AGG(DISTINCT o.Status, ',') as Statuses
            FROM Orders o
            WHERE o.OrderNo = @OrderNo AND o.CustomerName = @CustomerName
            GROUP BY o.OrderNo, o.CustomerName";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { OrderNo = payload.OrderNo, CustomerName = payload.CustomerName });
        
        if (x == null)
            throw new KeyNotFoundException("Sipariş grubu bulunamadı.");

        int totalExpected = Convert.ToInt32(x.totalexpectedquantity);
        int totalScanned = Convert.ToInt32(x.totalscannedquantity);
        decimal progress = totalExpected > 0 ? Math.Round((decimal)totalScanned / totalExpected * 100, 1) : 0m;
        
        string statusSummary = "Aktif";
        if (totalExpected > 0 && totalScanned >= totalExpected) {
            statusSummary = "Tamamlandı";
        }

        return new OrderGroupSummaryDto(
            request.GroupKey,
            x.orderno,
            x.customername,
            Convert.ToInt32(x.linecount),
            Convert.ToInt32(x.distinctworkordercount),
            totalExpected,
            totalScanned,
            progress,
            statusSummary,
            (DateTime)x.lastactivityat
        );
    }
}
