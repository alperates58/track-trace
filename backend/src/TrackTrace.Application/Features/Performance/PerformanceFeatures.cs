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
    public double TotalDurationSeconds { get; set; } // Raw wall-clock duration
    public double NetDurationSeconds { get; set; }   // Active work duration excluding shift/idle pauses (>10m)
    public double IdlePauseSeconds { get; set; }     // Detected shift breaks & overnight pauses
    public double AvgSecondsPerItem { get; set; }
    public double AvgSecondsPerCarton { get; set; }
    public bool HasPauseBreak { get; set; }
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
    public bool IsPauseBreak { get; set; }
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
    public double TotalIdlePauseSeconds { get; set; }
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
public record GetPerformanceSummaryQuery(DateTime? From = null, DateTime? To = null) : IRequest<PerformanceSummaryDto>;
public record GetOrderPerformanceQuery(string? Search = null, DateTime? From = null, DateTime? To = null) : IRequest<IEnumerable<OrderPerformanceDto>>;
public record GetCartonPerformanceDetailQuery(string OrderNo) : IRequest<IEnumerable<CartonPerformanceDto>>;
public record GetOperatorPerformanceQuery(DateTime? From = null, DateTime? To = null) : IRequest<IEnumerable<OperatorPerformanceDto>>;

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
            WITH FilteredProductCodes AS (
                SELECT Id, CartonId, OrderId, ScannedAt
                FROM ProductCodes
                WHERE Status != 'Uploaded' AND ScannedAt IS NOT NULL
                  AND (@From IS NULL OR ScannedAt >= @From)
                  AND (@To IS NULL OR ScannedAt <= @To)
            ),
            CartonDurations AS (
                SELECT 
                    c.Id,
                    GREATEST(5, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt)))) AS DurationSec,
                    COUNT(pc.Id) AS ItemCount
                FROM Cartons c
                INNER JOIN FilteredProductCodes pc ON c.Id = pc.CartonId
                GROUP BY c.Id
                HAVING COUNT(pc.Id) > 0
            ),
            CartonGaps AS (
                SELECT 
                    c.OrderId,
                    c.Id AS CartonId,
                    MIN(pc.ScannedAt) AS FirstScan,
                    MAX(pc.ScannedAt) AS LastScan,
                    LAG(MAX(pc.ScannedAt)) OVER (PARTITION BY c.OrderId ORDER BY MIN(pc.ScannedAt) ASC) AS PrevLastScan
                FROM Cartons c
                INNER JOIN FilteredProductCodes pc ON c.Id = pc.CartonId
                GROUP BY c.OrderId, c.Id
            ),
            OrderIdlePauses AS (
                SELECT 
                    OrderId,
                    SUM(CASE 
                        WHEN PrevLastScan IS NOT NULL AND FirstScan > PrevLastScan AND EXTRACT(EPOCH FROM (FirstScan - PrevLastScan)) > 600 
                        THEN EXTRACT(EPOCH FROM (FirstScan - PrevLastScan)) 
                        ELSE 0 
                    END) AS TotalIdlePauseSec
                FROM CartonGaps
                GROUP BY OrderId
            ),
            OrderDurations AS (
                SELECT 
                    o.OrderNo,
                    GREATEST(0, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt))) - COALESCE(p.TotalIdlePauseSec, 0)) AS NetOrderSec
                FROM Orders o
                INNER JOIN FilteredProductCodes pc ON o.Id = pc.OrderId
                LEFT JOIN OrderIdlePauses p ON o.Id = p.OrderId
                GROUP BY o.Id, o.OrderNo, p.TotalIdlePauseSec
                HAVING COUNT(pc.Id) > 1
            )
            SELECT 
                COALESCE(AVG(cd.DurationSec), 0) AS OverallAvgSecondsPerCarton,
                COALESCE(AVG(CASE WHEN cd.ItemCount > 0 THEN cd.DurationSec / cd.ItemCount ELSE 0 END), 0) AS OverallAvgSecondsPerItem,
                (SELECT COUNT(*) FROM Orders WHERE Status = 'Completed') AS TotalCompletedOrders,
                COALESCE((SELECT COUNT(DISTINCT CartonId) FROM FilteredProductCodes WHERE CartonId IS NOT NULL), 0) AS TotalScannedCartons,
                COALESCE((SELECT OrderNo FROM OrderDurations WHERE NetOrderSec > 0 ORDER BY NetOrderSec ASC LIMIT 1), '-') AS FastestOrderNo,
                COALESCE((SELECT NetOrderSec FROM OrderDurations WHERE NetOrderSec > 0 ORDER BY NetOrderSec ASC LIMIT 1), 0) AS FastestOrderDurationSeconds,
                COALESCE((SELECT SUM(TotalIdlePauseSec) FROM OrderIdlePauses), 0) AS TotalIdlePauseSeconds
            FROM CartonDurations cd;";

        var result = await connection.QueryFirstOrDefaultAsync<PerformanceSummaryDto>(
            new CommandDefinition(sql, new { From = request.From, To = request.To }, cancellationToken: cancellationToken));

        return result ?? new PerformanceSummaryDto();
    }

    public async Task<IEnumerable<OrderPerformanceDto>> Handle(GetOrderPerformanceQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();

        string sql = @"
            WITH FilteredProductCodes AS (
                SELECT Id, CartonId, OrderId, ScannedAt
                FROM ProductCodes
                WHERE Status != 'Uploaded' AND ScannedAt IS NOT NULL
                  AND (@From IS NULL OR ScannedAt >= @From)
                  AND (@To IS NULL OR ScannedAt <= @To)
            ),
            CartonTimeInfo AS (
                SELECT 
                    c.OrderId,
                    c.Id AS CartonId,
                    MIN(pc.ScannedAt) AS FirstScan,
                    MAX(pc.ScannedAt) AS LastScan,
                    GREATEST(5, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt)))) AS FillSec
                FROM Cartons c
                INNER JOIN FilteredProductCodes pc ON c.Id = pc.CartonId
                GROUP BY c.OrderId, c.Id
            ),
            CartonGaps AS (
                SELECT 
                    OrderId,
                    FillSec,
                    FirstScan,
                    LastScan,
                    LAG(LastScan) OVER (PARTITION BY OrderId ORDER BY FirstScan ASC) AS PrevLastScan
                FROM CartonTimeInfo
            ),
            OrderPauseGaps AS (
                SELECT 
                    OrderId,
                    SUM(CASE 
                        WHEN PrevLastScan IS NOT NULL AND FirstScan > PrevLastScan AND EXTRACT(EPOCH FROM (FirstScan - PrevLastScan)) > 600 
                        THEN EXTRACT(EPOCH FROM (FirstScan - PrevLastScan)) 
                        ELSE 0 
                    END) AS IdlePauseSec
                FROM CartonGaps
                GROUP BY OrderId
            )
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
                COALESCE(opg.IdlePauseSec, 0) AS IdlePauseSeconds,
                o.Status
            FROM Orders o
            LEFT JOIN (
                SELECT OrderId, COUNT(DISTINCT Id) AS TotalCartons
                FROM Cartons
                GROUP BY OrderId
            ) c ON o.Id = c.OrderId
            LEFT JOIN (
                SELECT OrderId, COUNT(Id) AS TotalScanned, MIN(ScannedAt) AS FirstScannedAt, MAX(ScannedAt) AS LastScannedAt
                FROM FilteredProductCodes
                GROUP BY OrderId
            ) pc ON o.Id = pc.OrderId
            LEFT JOIN OrderPauseGaps opg ON o.Id = opg.OrderId
            WHERE 1=1 ";

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            sql += " AND (o.OrderNo ILIKE @Search OR o.CustomerName ILIKE @Search OR o.StockCode ILIKE @Search OR o.ProductName ILIKE @Search) ";
        }
        if (request.From.HasValue)
        {
            sql += " AND (pc.LastScannedAt >= @From OR (pc.LastScannedAt IS NULL AND o.CreatedAt >= @From)) ";
        }
        if (request.To.HasValue)
        {
            sql += " AND (pc.FirstScannedAt <= @To OR (pc.FirstScannedAt IS NULL AND o.CreatedAt <= @To)) ";
        }

        sql += @"
            ORDER BY pc.LastScannedAt DESC NULLS LAST, o.CreatedAt DESC;";

        var searchParam = string.IsNullOrWhiteSpace(request.Search) ? "" : $"%{request.Search}%";
        var rawItems = await connection.QueryAsync<dynamic>(
            new CommandDefinition(sql, new { Search = searchParam, From = request.From, To = request.To }, cancellationToken: cancellationToken));

        var list = new List<OrderPerformanceDto>();
        foreach (var x in rawItems)
        {
            double totalSec = x.totaldurationseconds != null ? Convert.ToDouble(x.totaldurationseconds) : 0;
            double idlePauseSec = x.idlepauseseconds != null ? Convert.ToDouble(x.idlepauseseconds) : 0;
            int totalScanned = Convert.ToInt32(x.totalscanned);
            int totalCartons = Convert.ToInt32(x.totalcartons);

            // Net duration deducts shift breaks (> 10 mins) from raw elapsed wall-clock duration
            double netSec = Math.Max(0, totalSec - idlePauseSec);
            if (netSec == 0 && totalScanned > 0)
            {
                netSec = totalCartons > 0 ? totalCartons * 45.0 : totalScanned * 1.5;
            }

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
                TotalDurationSeconds = totalSec,
                NetDurationSeconds = netSec,
                IdlePauseSeconds = idlePauseSec,
                AvgSecondsPerItem = totalScanned > 0 ? Math.Round(netSec / totalScanned, 2) : 0,
                AvgSecondsPerCarton = totalCartons > 0 ? Math.Round(netSec / totalCartons, 1) : 0,
                HasPauseBreak = idlePauseSec > 600,
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

            bool isPause = idleSec > 600;
            string pace = fillSec <= 35 ? "Hızlı" : fillSec <= 90 ? "Normal" : "Yavaş";

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
                IsPauseBreak = isPause,
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
            WITH FilteredProductCodes AS (
                SELECT Id, CartonId, ScannedAt, ScannedBy
                FROM ProductCodes
                WHERE Status != 'Uploaded' AND ScannedAt IS NOT NULL AND ScannedBy IS NOT NULL
                  AND (@From IS NULL OR ScannedAt >= @From)
                  AND (@To IS NULL OR ScannedAt <= @To)
            ),
            CartonTimes AS (
                SELECT 
                    CartonId,
                    ScannedBy,
                    MIN(ScannedAt) AS FirstScan,
                    MAX(ScannedAt) AS LastScan,
                    GREATEST(5, EXTRACT(EPOCH FROM (MAX(ScannedAt) - MIN(ScannedAt)))) AS FillSec
                FROM FilteredProductCodes
                GROUP BY CartonId, ScannedBy
            ),
            CartonGaps AS (
                SELECT 
                    ScannedBy,
                    FillSec,
                    FirstScan,
                    LastScan,
                    LAG(LastScan) OVER (PARTITION BY ScannedBy ORDER BY FirstScan ASC) AS PrevLastScan
                FROM CartonTimes
            ),
            OperatorNetActive AS (
                SELECT 
                    ScannedBy,
                    SUM(FillSec + CASE WHEN PrevLastScan IS NOT NULL AND FirstScan > PrevLastScan AND EXTRACT(EPOCH FROM (FirstScan - PrevLastScan)) <= 600 THEN EXTRACT(EPOCH FROM (FirstScan - PrevLastScan)) ELSE 0 END) AS NetActiveSec
                FROM CartonGaps
                GROUP BY ScannedBy
            )
            SELECT 
                COALESCE(u.Name, 'Operatör') AS OperatorName,
                COUNT(DISTINCT pc.CartonId) AS TotalCartons,
                COUNT(pc.Id) AS TotalScannedItems,
                COALESCE(ona.NetActiveSec, GREATEST(1, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt))))) AS TotalActiveSeconds
            FROM FilteredProductCodes pc
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            LEFT JOIN OperatorNetActive ona ON pc.ScannedBy = ona.ScannedBy
            GROUP BY u.Name, ona.NetActiveSec
            ORDER BY COUNT(pc.Id) DESC;";

        var rawItems = await connection.QueryAsync<dynamic>(
            new CommandDefinition(sql, new { From = request.From, To = request.To }, cancellationToken: cancellationToken));

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

        // Benchmark score calculation: Lowest avg carton seconds among operators with at least 1 scanned carton
        double minAvgCartonSec = tempList.Where(t => t.Cartons > 0 && t.Items > 0 && t.AvgCartonSec > 0).Select(t => t.AvgCartonSec).DefaultIfEmpty(0).Min();

        var list = new List<OperatorPerformanceDto>();
        foreach (var t in tempList)
        {
            double score = 0;
            bool isLeader = false;
            string grade = "Henüz İşlem Yok";

            if (t.Cartons > 0 && t.Items > 0 && t.AvgCartonSec > 0 && minAvgCartonSec > 0)
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
