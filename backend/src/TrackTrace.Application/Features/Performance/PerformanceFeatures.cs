using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Performance;

public class OrderPerformanceDto
{
    public Guid OrderId { get; set; }
    public string OrderNo { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string StockCode { get; set; } = "";
    public string ProductName { get; set; } = "";
    public int ExpectedQuantity { get; set; }
    public int TotalCartons { get; set; }
    public int TotalScanned { get; set; }
    public DateTime? FirstScannedAt { get; set; }
    public DateTime? LastScannedAt { get; set; }
    public double TotalDurationSeconds { get; set; }
    public double AvgSecondsPerItem { get; set; }
    public double AvgSecondsPerCarton { get; set; }
    public string Status { get; set; } = "";
}

public class CartonPerformanceDto
{
    public Guid CartonId { get; set; }
    public string CartonNo { get; set; } = "";
    public string SSCC { get; set; } = "";
    public int ActualQuantity { get; set; }
    public string? Gtin { get; set; }
    public DateTime? FirstScannedAt { get; set; }
    public DateTime? LastScannedAt { get; set; }
    public double FillDurationSeconds { get; set; }
    public double IdleSecondsFromPrevious { get; set; }
    public string? OperatorName { get; set; }
    public string PaceCategory { get; set; } = "Normal"; // Fast, Normal, Slow
}

public class PerformanceSummaryDto
{
    public double OverallAvgSecondsPerCarton { get; set; }
    public double OverallAvgSecondsPerItem { get; set; }
    public int TotalCompletedOrders { get; set; }
    public int TotalScannedCartons { get; set; }
    public string FastestOrderNo { get; set; } = "-";
    public double FastestOrderDurationSeconds { get; set; }
}

public class OperatorPerformanceDto
{
    public string OperatorName { get; set; } = "";
    public int TotalCartons { get; set; }
    public int TotalScannedItems { get; set; }
    public double AvgSecondsPerCarton { get; set; }
    public double ItemsPerMinute { get; set; }
    public double Score { get; set; } // 100-point benchmark score
    public bool IsBenchmarkLeader { get; set; }
    public string ScoreGrade { get; set; } = "Standart";
}

// Queries
public record GetPerformanceSummaryQuery : IRequest<PerformanceSummaryDto>;
public record GetOrderPerformanceQuery(string? Search = null) : IRequest<IEnumerable<OrderPerformanceDto>>;
public record GetCartonPerformanceDetailQuery(string OrderNo) : IRequest<IEnumerable<CartonPerformanceDto>>;
public record GetOperatorPerformanceQuery : IRequest<IEnumerable<OperatorPerformanceDto>>;

// Handlers
public class PerformanceHandlers :
    IRequestHandler<GetPerformanceSummaryQuery, PerformanceSummaryDto>,
    IRequestHandler<GetOrderPerformanceQuery, IEnumerable<OrderPerformanceDto>>,
    IRequestHandler<GetCartonPerformanceDetailQuery, IEnumerable<CartonPerformanceDto>>,
    IRequestHandler<GetOperatorPerformanceQuery, IEnumerable<OperatorPerformanceDto>>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public PerformanceHandlers(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<PerformanceSummaryDto> Handle(GetPerformanceSummaryQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string sql = @"
            WITH CartonDurations AS (
                SELECT 
                    c.Id,
                    EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt))) AS DurationSec,
                    COUNT(pc.Id) AS ItemCount
                FROM Cartons c
                INNER JOIN ProductCodes pc ON c.Id = pc.CartonId
                WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL
                GROUP BY c.Id
                HAVING COUNT(pc.Id) > 1 AND MAX(pc.ScannedAt) > MIN(pc.ScannedAt)
            ),
            OrderDurations AS (
                SELECT 
                    o.OrderNo,
                    EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt))) AS OrderSec,
                    COUNT(pc.Id) AS ItemCount
                FROM Orders o
                INNER JOIN ProductCodes pc ON o.Id = pc.OrderId
                WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL
                GROUP BY o.Id, o.OrderNo
                HAVING COUNT(pc.Id) > 1 AND MAX(pc.ScannedAt) > MIN(pc.ScannedAt)
            )
            SELECT 
                COALESCE(AVG(cd.DurationSec), 0) AS OverallAvgSecondsPerCarton,
                COALESCE(AVG(CASE WHEN cd.ItemCount > 0 THEN cd.DurationSec / cd.ItemCount ELSE 0 END), 0) AS OverallAvgSecondsPerItem,
                (SELECT COUNT(*) FROM Orders WHERE Status = 'Completed') AS TotalCompletedOrders,
                (SELECT COUNT(DISTINCT CartonId) FROM ProductCodes WHERE Status != 'Uploaded' AND CartonId IS NOT NULL) AS TotalScannedCartons,
                COALESCE((SELECT OrderNo FROM OrderDurations ORDER BY OrderSec ASC LIMIT 1), '-') AS FastestOrderNo,
                COALESCE((SELECT OrderSec FROM OrderDurations ORDER BY OrderSec ASC LIMIT 1), 0) AS FastestOrderDurationSeconds
            FROM CartonDurations cd;";

        var result = await connection.QueryFirstOrDefaultAsync<PerformanceSummaryDto>(
            new CommandDefinition(sql, cancellationToken: cancellationToken));

        return result ?? new PerformanceSummaryDto();
    }

    public async Task<IEnumerable<OrderPerformanceDto>> Handle(GetOrderPerformanceQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();

        string sql = @"
            SELECT 
                o.Id AS OrderId,
                o.OrderNo,
                o.CustomerName,
                o.StockCode,
                o.ProductName,
                o.ExpectedQuantity,
                COALESCE(c.TotalCartons, 0) AS TotalCartons,
                COALESCE(pc.TotalScanned, 0) AS TotalScanned,
                pc.FirstScannedAt,
                pc.LastScannedAt,
                CASE 
                    WHEN pc.FirstScannedAt IS NOT NULL AND pc.LastScannedAt IS NOT NULL 
                    THEN GREATEST(0, EXTRACT(EPOCH FROM (pc.LastScannedAt - pc.FirstScannedAt)))
                    ELSE 0 
                END AS TotalDurationSeconds,
                o.Status
            FROM Orders o
            LEFT JOIN (
                SELECT OrderId, COUNT(DISTINCT Id) AS TotalCartons
                FROM Cartons
                GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(Id) AS TotalScanned, MIN(ScannedAt) AS FirstScannedAt, MAX(ScannedAt) AS LastScannedAt
                FROM ProductCodes
                WHERE Status != 'Uploaded' AND ScannedAt IS NOT NULL
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            WHERE 1=1 ";

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            sql += " AND (o.OrderNo ILIKE @Search OR o.CustomerName ILIKE @Search OR o.StockCode ILIKE @Search OR o.ProductName ILIKE @Search) ";
        }

        sql += @"
            ORDER BY pc.LastScannedAt DESC NULLS LAST, o.CreatedAt DESC;";

        var searchParam = string.IsNullOrWhiteSpace(request.Search) ? "" : $"%{request.Search}%";
        var rawItems = await connection.QueryAsync<dynamic>(
            new CommandDefinition(sql, new { Search = searchParam }, cancellationToken: cancellationToken));

        var list = new List<OrderPerformanceDto>();
        foreach (var x in rawItems)
        {
            double durationSec = x.totaldurationseconds != null ? Convert.ToDouble(x.totaldurationseconds) : 0;
            int totalScanned = Convert.ToInt32(x.totalscanned);
            int totalCartons = Convert.ToInt32(x.totalcartons);

            list.Add(new OrderPerformanceDto
            {
                OrderId = (Guid)x.orderid,
                OrderNo = (string)x.orderno,
                CustomerName = (string)x.customername,
                StockCode = (string)x.stockcode,
                ProductName = (string)x.productname ?? "",
                ExpectedQuantity = Convert.ToInt32(x.expectedquantity),
                TotalCartons = totalCartons,
                TotalScanned = totalScanned,
                FirstScannedAt = x.firstscannedat != null ? (DateTime?)x.firstscannedat : null,
                LastScannedAt = x.lastscannedat != null ? (DateTime?)x.lastscannedat : null,
                TotalDurationSeconds = durationSec,
                AvgSecondsPerItem = totalScanned > 0 ? Math.Round(durationSec / totalScanned, 2) : 0,
                AvgSecondsPerCarton = totalCartons > 0 ? Math.Round(durationSec / totalCartons, 2) : 0,
                Status = (string)x.status
            });
        }

        return list;
    }

    public async Task<IEnumerable<CartonPerformanceDto>> Handle(GetCartonPerformanceDetailQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();

        const string sql = @"
            SELECT 
                c.Id AS CartonId,
                c.CartonNo,
                c.SSCC,
                c.ActualQuantity,
                pc.Gtin,
                MIN(pc.ScannedAt) AS FirstScannedAt,
                MAX(pc.ScannedAt) AS LastScannedAt,
                GREATEST(0, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt)))) AS FillDurationSeconds,
                u.Name AS OperatorName
            FROM Cartons c
            INNER JOIN Orders o ON c.OrderId = o.Id
            INNER JOIN ProductCodes pc ON c.Id = pc.CartonId
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            WHERE o.OrderNo = @OrderNo AND pc.Status != 'Uploaded'
            GROUP BY c.Id, c.CartonNo, c.SSCC, c.ActualQuantity, pc.Gtin, u.Name
            ORDER BY MIN(pc.ScannedAt) ASC;";

        var rawItems = await connection.QueryAsync<dynamic>(
            new CommandDefinition(sql, new { OrderNo = request.OrderNo }, cancellationToken: cancellationToken));

        var list = new List<CartonPerformanceDto>();
        DateTime? previousCartonEnd = null;

        foreach (var x in rawItems)
        {
            DateTime? firstScan = x.firstscannedat != null ? (DateTime?)x.firstscannedat : null;
            DateTime? lastScan = x.lastscannedat != null ? (DateTime?)x.lastscannedat : null;
            double fillSec = x.filldurationseconds != null ? Convert.ToDouble(x.filldurationseconds) : 0;

            double idleSec = 0;
            if (previousCartonEnd.HasValue && firstScan.HasValue)
            {
                idleSec = Math.Max(0, (firstScan.Value - previousCartonEnd.Value).TotalSeconds);
            }
            if (lastScan.HasValue)
            {
                previousCartonEnd = lastScan;
            }

            string pace = fillSec <= 30 ? "Hızlı" : fillSec <= 90 ? "Normal" : "Yavaş";

            list.Add(new CartonPerformanceDto
            {
                CartonId = (Guid)x.cartonid,
                CartonNo = (string)x.cartonno,
                SSCC = (string)x.sscc,
                ActualQuantity = Convert.ToInt32(x.actualquantity),
                Gtin = (string?)x.gtin,
                FirstScannedAt = firstScan,
                LastScannedAt = lastScan,
                FillDurationSeconds = fillSec,
                IdleSecondsFromPrevious = Math.Round(idleSec, 1),
                OperatorName = (string?)x.operatorname ?? "Operatör",
                PaceCategory = pace
            });
        }

        return list;
    }

    public async Task<IEnumerable<OperatorPerformanceDto>> Handle(GetOperatorPerformanceQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();

        const string sql = @"
            SELECT 
                COALESCE(u.Name, 'Operatör') AS OperatorName,
                COUNT(DISTINCT pc.CartonId) AS TotalCartons,
                COUNT(pc.Id) AS TotalScannedItems,
                MIN(pc.ScannedAt) AS FirstScan,
                MAX(pc.ScannedAt) AS LastScan,
                GREATEST(1, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt)))) AS TotalActiveSeconds
            FROM ProductCodes pc
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL AND pc.ScannedBy IS NOT NULL
            GROUP BY u.Name
            ORDER BY COUNT(pc.Id) DESC;";

        var rawItems = await connection.QueryAsync<dynamic>(
            new CommandDefinition(sql, cancellationToken: cancellationToken));

        var tempList = new List<(string Name, int Cartons, int Items, double TotalSec, double AvgCartonSec, double ItemsPerMin)>();
        foreach (var x in rawItems)
        {
            double totalSec = x.totalactiveseconds != null ? Convert.ToDouble(x.totalactiveseconds) : 0;
            int items = Convert.ToInt32(x.totalscanneditems);
            int cartons = Convert.ToInt32(x.totalcartons);

            double itemsPerMin = totalSec > 0 ? Math.Round((items / totalSec) * 60.0, 1) : 0;
            double avgCartonSec = cartons > 0 && totalSec > 0 ? Math.Round(totalSec / cartons, 1) : 0;

            tempList.Add(((string)x.operatorname, cartons, items, totalSec, avgCartonSec, itemsPerMin));
        }

        // Benchmark score calculation: Lowest avg carton seconds gets 100 Points
        double minAvgCartonSec = tempList.Where(t => t.AvgCartonSec > 0).Select(t => t.AvgCartonSec).DefaultIfEmpty(0).Min();

        var list = new List<OperatorPerformanceDto>();
        foreach (var t in tempList)
        {
            double score = 0;
            bool isLeader = false;
            string grade = "Standart";

            if (t.AvgCartonSec > 0 && minAvgCartonSec > 0)
            {
                score = Math.Min(100.0, Math.Round((minAvgCartonSec / t.AvgCartonSec) * 100.0, 1));
                if (Math.Abs(t.AvgCartonSec - minAvgCartonSec) < 0.01)
                {
                    score = 100.0;
                    isLeader = true;
                    grade = "🏆 100 Puan (Lider)";
                }
                else if (score >= 80) grade = "🟢 Üstün Performans";
                else if (score >= 60) grade = "🔵 İyi Performans";
                else if (score >= 40) grade = "🟡 Standart Performans";
                else grade = "🔴 Geliştirilmeli";
            }

            list.Add(new OperatorPerformanceDto
            {
                OperatorName = t.Name,
                TotalCartons = t.Cartons,
                TotalScannedItems = t.Items,
                AvgSecondsPerCarton = t.AvgCartonSec,
                ItemsPerMinute = t.ItemsPerMin,
                Score = score,
                IsBenchmarkLeader = isLeader,
                ScoreGrade = grade
            });
        }

        return list.OrderByDescending(x => x.Score).ThenByDescending(x => x.TotalScannedItems);
    }
}
