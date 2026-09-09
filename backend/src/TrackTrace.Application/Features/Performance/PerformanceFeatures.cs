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
        var p = new DynamicParameters();

        string dateFilter = "";
        if (request.From.HasValue)
        {
            dateFilter += " AND pc.ScannedAt >= @From ";
            p.Add("From", request.From.Value);
        }
        if (request.To.HasValue)
        {
            dateFilter += " AND pc.ScannedAt <= @To ";
            p.Add("To", request.To.Value);
        }

        string sql = $@"
            WITH CartonDurations AS (
                SELECT 
                    c.Id,
                    GREATEST(5, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt)))) AS DurationSec,
                    COUNT(pc.Id) AS ItemCount
                FROM Cartons c
                INNER JOIN ProductCodes pc ON c.Id = pc.CartonId
                WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL {dateFilter}
                GROUP BY c.Id
                HAVING COUNT(pc.Id) > 0
            )
            SELECT 
                COALESCE(AVG(cd.DurationSec), 0) AS OverallAvgSecondsPerCarton,
                COALESCE(AVG(CASE WHEN cd.ItemCount > 0 THEN cd.DurationSec / cd.ItemCount ELSE 0 END), 0) AS OverallAvgSecondsPerItem,
                (SELECT COUNT(*) FROM Orders WHERE Status = 'Completed') AS TotalCompletedOrders,
                COALESCE((SELECT COUNT(DISTINCT pc.CartonId) FROM ProductCodes pc WHERE pc.Status != 'Uploaded' AND pc.CartonId IS NOT NULL {dateFilter}), 0) AS TotalScannedCartons
            FROM CartonDurations cd;";

        var summary = await connection.QueryFirstOrDefaultAsync<PerformanceSummaryDto>(
            new CommandDefinition(sql, p, cancellationToken: cancellationToken)) ?? new PerformanceSummaryDto();

        // Calculate fastest order and total idle pause seconds using the orders calculation
        var allOrders = (await Handle(new GetOrderPerformanceQuery(null, request.From, request.To), cancellationToken)).ToList();
        if (allOrders.Any())
        {
            var completed = allOrders.Where(o => o.Status == "Completed" && o.NetDurationSeconds > 0).OrderBy(o => o.AvgSecondsPerCarton).ToList();
            if (completed.Any())
            {
                summary.FastestOrderNo = completed.First().OrderNo;
                summary.FastestOrderDurationSeconds = completed.First().NetDurationSeconds;
            }
            else
            {
                var anyWithTime = allOrders.Where(o => o.NetDurationSeconds > 0).OrderBy(o => o.AvgSecondsPerCarton).FirstOrDefault();
                if (anyWithTime != null)
                {
                    summary.FastestOrderNo = anyWithTime.OrderNo;
                    summary.FastestOrderDurationSeconds = anyWithTime.NetDurationSeconds;
                }
            }
            summary.TotalIdlePauseSeconds = allOrders.Sum(o => o.IdlePauseSeconds);
        }

        return summary;
    }

    public async Task<IEnumerable<OrderPerformanceDto>> Handle(GetOrderPerformanceQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var p = new DynamicParameters();

        string dateFilterProduct = "";
        string dateFilterOrder = "";
        if (request.From.HasValue)
        {
            dateFilterProduct += " AND pc.ScannedAt >= @From ";
            dateFilterOrder += " AND (pc.LastScannedAt >= @From OR (pc.LastScannedAt IS NULL AND o.CreatedAt >= @From)) ";
            p.Add("From", request.From.Value);
        }
        if (request.To.HasValue)
        {
            dateFilterProduct += " AND pc.ScannedAt <= @To ";
            dateFilterOrder += " AND (pc.FirstScannedAt <= @To OR (pc.FirstScannedAt IS NULL AND o.CreatedAt <= @To)) ";
            p.Add("To", request.To.Value);
        }

        string searchFilter = "";
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            searchFilter = " AND (o.OrderNo ILIKE @Search OR o.CustomerName ILIKE @Search OR o.StockCode ILIKE @Search OR o.ProductName ILIKE @Search) ";
            p.Add("Search", $"%{request.Search.Trim()}%");
        }

        // 1. Fetch orders with counts
        string ordersSql = $@"
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
            WHERE 1=1 {searchFilter} {dateFilterOrder}
            ORDER BY pc.LastScannedAt DESC NULLS LAST, o.CreatedAt DESC;";

        var rawOrders = (await connection.QueryAsync<dynamic>(
            new CommandDefinition(ordersSql, p, cancellationToken: cancellationToken))).ToList();

        if (!rawOrders.Any())
        {
            return Enumerable.Empty<OrderPerformanceDto>();
        }

        // 2. Fetch carton timings for orders to calculate net active duration and exclude pauses > 10 mins
        string cartonsSql = $@"
            SELECT 
                c.OrderId,
                c.Id AS CartonId,
                c.CartonNo,
                MIN(pc.ScannedAt) AS FirstScan,
                MAX(pc.ScannedAt) AS LastScan
            FROM Cartons c
            INNER JOIN ProductCodes pc ON c.Id = pc.CartonId
            WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL {dateFilterProduct}
            GROUP BY c.OrderId, c.Id, c.CartonNo
            ORDER BY c.OrderId, MIN(pc.ScannedAt) ASC;";

        var rawCartons = (await connection.QueryAsync<dynamic>(
            new CommandDefinition(cartonsSql, p, cancellationToken: cancellationToken))).ToList();

        var orderMetricsMap = new Dictionary<Guid, (double NetSec, double IdlePauseSec)>();
        foreach (var group in rawCartons.GroupBy(x => (Guid)x.orderid))
        {
            double netSec = 0;
            double idlePauseSec = 0;
            DateTime? prevEnd = null;

            foreach (var c in group)
            {
                DateTime firstScan = (DateTime)c.firstscan;
                DateTime lastScan = (DateTime)c.lastscan;
                double fillSec = Math.Max(5, (lastScan - firstScan).TotalSeconds);

                if (prevEnd.HasValue)
                {
                    double gap = (firstScan - prevEnd.Value).TotalSeconds;
                    if (gap > 600) // 10 mins shift break / pause
                    {
                        idlePauseSec += gap;
                    }
                    else if (gap > 0)
                    {
                        netSec += gap; // normal transition
                    }
                }
                netSec += fillSec;
                prevEnd = lastScan;
            }

            orderMetricsMap[group.Key] = (netSec, idlePauseSec);
        }

        var list = new List<OrderPerformanceDto>();
        foreach (var x in rawOrders)
        {
            Guid orderId = (Guid)x.orderid;
            double totalSec = x.totaldurationseconds != null ? Convert.ToDouble(x.totaldurationseconds) : 0;
            int totalScanned = Convert.ToInt32(x.totalscanned);
            int totalCartons = Convert.ToInt32(x.totalcartons);

            double netSec = totalSec;
            double idlePauseSec = 0;

            if (orderMetricsMap.TryGetValue(orderId, out var metrics))
            {
                netSec = metrics.NetSec;
                idlePauseSec = metrics.IdlePauseSec;
            }
            else if (totalSec > 0)
            {
                netSec = totalSec;
            }

            if (netSec == 0 && totalScanned > 0)
            {
                netSec = totalCartons > 0 ? totalCartons * 45.0 : totalScanned * 1.5;
            }

            list.Add(new OrderPerformanceDto
            {
                OrderId = orderId,
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
                NetDurationSeconds = Math.Round(netSec, 1),
                IdlePauseSeconds = Math.Round(idlePauseSec, 1),
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
        var p = new DynamicParameters();

        string dateFilter = "";
        if (request.From.HasValue)
        {
            dateFilter += " AND pc.ScannedAt >= @From ";
            p.Add("From", request.From.Value);
        }
        if (request.To.HasValue)
        {
            dateFilter += " AND pc.ScannedAt <= @To ";
            p.Add("To", request.To.Value);
        }

        string sql = $@"
            SELECT 
                COALESCE(u.Name, 'Operatör') AS OperatorName,
                pc.ScannedBy,
                COUNT(DISTINCT pc.CartonId) AS TotalCartons,
                COUNT(pc.Id) AS TotalScannedItems,
                MIN(pc.ScannedAt) AS FirstScan,
                MAX(pc.ScannedAt) AS LastScan,
                GREATEST(1, EXTRACT(EPOCH FROM (MAX(pc.ScannedAt) - MIN(pc.ScannedAt)))) AS TotalActiveSeconds
            FROM ProductCodes pc
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL AND pc.ScannedBy IS NOT NULL {dateFilter}
            GROUP BY u.Name, pc.ScannedBy
            ORDER BY COUNT(pc.Id) DESC;";

        var rawItems = (await connection.QueryAsync<dynamic>(
            new CommandDefinition(sql, p, cancellationToken: cancellationToken))).ToList();

        // Also fetch operator carton timings to exclude idle gaps > 10m
        string opCartonSql = $@"
            SELECT 
                pc.ScannedBy,
                pc.CartonId,
                MIN(pc.ScannedAt) AS FirstScan,
                MAX(pc.ScannedAt) AS LastScan
            FROM ProductCodes pc
            WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL AND pc.ScannedBy IS NOT NULL {dateFilter}
            GROUP BY pc.ScannedBy, pc.CartonId
            ORDER BY pc.ScannedBy, MIN(pc.ScannedAt) ASC;";

        var rawOpCartons = (await connection.QueryAsync<dynamic>(
            new CommandDefinition(opCartonSql, p, cancellationToken: cancellationToken))).ToList();

        var opNetActiveMap = new Dictionary<Guid, double>();
        foreach (var group in rawOpCartons.GroupBy(x => (Guid)x.scannedby))
        {
            double netSec = 0;
            DateTime? prevEnd = null;
            foreach (var c in group)
            {
                DateTime firstScan = (DateTime)c.firstscan;
                DateTime lastScan = (DateTime)c.lastscan;
                double fillSec = Math.Max(5, (lastScan - firstScan).TotalSeconds);
                if (prevEnd.HasValue)
                {
                    double gap = (firstScan - prevEnd.Value).TotalSeconds;
                    if (gap <= 600 && gap > 0)
                    {
                        netSec += gap;
                    }
                }
                netSec += fillSec;
                prevEnd = lastScan;
            }
            opNetActiveMap[group.Key] = Math.Max(1, netSec);
        }

        var tempList = new List<(string Name, int Cartons, int Items, double TotalSec, double AvgCartonSec, double ItemsPerMin)>();
        foreach (var x in rawItems)
        {
            Guid? scannedBy = x.scannedby != null ? (Guid?)x.scannedby : null;
            double totalSec = x.totalactiveseconds != null ? Convert.ToDouble(x.totalactiveseconds) : 0;
            if (scannedBy.HasValue && opNetActiveMap.TryGetValue(scannedBy.Value, out var netSec))
            {
                totalSec = netSec;
            }

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
