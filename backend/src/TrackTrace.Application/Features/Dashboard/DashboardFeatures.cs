using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Dashboard;

public class LiveStationDto
{
    public Guid StationId { get; set; }
    public string StationName { get; set; } = "";
    public string StationCode { get; set; } = "";
    public string Status { get; set; } = "Idle"; // Active, Idle
    public string? OperatorName { get; set; }
    public string? CurrentOrderNo { get; set; }
    public string? CurrentStockCode { get; set; }
    public string? CurrentProductName { get; set; }
    public string? CurrentCartonNo { get; set; }
    public string? CurrentCartonSscc { get; set; }
    public int CartonCurrentQty { get; set; }
    public int CartonTargetQty { get; set; }
    public DateTime? LastScannedAt { get; set; }
    public int ItemsScannedLastHour { get; set; }
    public int ItemsScannedToday { get; set; }
    public double StationPaceSecondsPerItem { get; set; }
}

public class LiveScanItemDto
{
    public Guid Id { get; set; }
    public string RawCode { get; set; } = "";
    public string OrderNo { get; set; } = "";
    public string StockCode { get; set; } = "";
    public string CartonNo { get; set; } = "";
    public string StationName { get; set; } = "";
    public string OperatorName { get; set; } = "";
    public DateTime ScannedAt { get; set; }
}

public class DashboardLiveFeedDto
{
    public int ActiveStationCount { get; set; }
    public int TodayTotalItems { get; set; }
    public int TodayTotalCartons { get; set; }
    public double CurrentPaceItemsPerMin { get; set; }
    public double CurrentPaceSecondsPerItem { get; set; }
    public double AvgPace30MinSecondsPerItem { get; set; }
    public double ProductionEfficiencyPct { get; set; } = 100.0;
    public List<LiveStationDto> ActiveStations { get; set; } = new();
    public List<LiveScanItemDto> RecentScansFeed { get; set; } = new();
}

public record GetDashboardLiveFeedQuery : IRequest<DashboardLiveFeedDto>;

public class DashboardLiveFeedHandler : IRequestHandler<GetDashboardLiveFeedQuery, DashboardLiveFeedDto>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public DashboardLiveFeedHandler(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<DashboardLiveFeedDto> Handle(GetDashboardLiveFeedQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();

        // 1. Live Feed Item Stream
        const string feedSql = @"
            SELECT 
                pc.Id,
                pc.RawCode,
                COALESCE(o.OrderNo, '-') AS OrderNo,
                COALESCE(o.StockCode, '-') AS StockCode,
                COALESCE(c.CartonNo, '-') AS CartonNo,
                COALESCE(s.Name, 'Genel İstasyon') AS StationName,
                COALESCE(u.Name, 'Operatör') AS OperatorName,
                pc.ScannedAt
            FROM ProductCodes pc
            LEFT JOIN Orders o ON pc.OrderId = o.Id
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN Stations s ON c.StationId = s.Id
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            WHERE pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL
            ORDER BY pc.ScannedAt DESC
            LIMIT 15;";

        var feedItems = (await connection.QueryAsync<LiveScanItemDto>(
            new CommandDefinition(feedSql, cancellationToken: cancellationToken))).ToList();

        // 2. Stations Live Status
        const string stationsSql = @"
            SELECT 
                s.Id AS StationId,
                s.Name AS StationName,
                s.Name AS StationCode,
                last_scan.ScannedAt AS LastScannedAt,
                COALESCE(today_scans.ItemCount, 0) AS ItemsScannedToday,
                COALESCE(hour_scans.ItemCount, 0) AS ItemsScannedLastHour,
                COALESCE(last_scan.OperatorName, 'Operatör') AS OperatorName,
                CASE 
                    WHEN last_scan.OrderNo IS NOT NULL AND last_scan.CustomerName IS NOT NULL THEN last_scan.OrderNo || ' / ' || last_scan.CustomerName
                    WHEN last_scan.OrderNo IS NOT NULL THEN last_scan.OrderNo
                    ELSE '-'
                END AS CurrentOrderNo,
                COALESCE(last_scan.StockCode, '-') AS CurrentStockCode,
                COALESCE(last_scan.ProductName, '-') AS CurrentProductName,
                COALESCE(last_scan.CartonNo, '-') AS CurrentCartonNo,
                COALESCE(last_scan.SSCC, '-') AS CurrentCartonSscc,
                COALESCE(last_scan.ActualQuantity, 0) AS CartonCurrentQty,
                COALESCE(last_scan.ProductPerCarton, 1) AS CartonTargetQty,
                COALESCE(st_pace.PaceSec, 0) AS StationPaceSecondsPerItem
            FROM Stations s
            LEFT JOIN LATERAL (
                SELECT 
                    pc.ScannedAt,
                    u.Name AS OperatorName,
                    o.OrderNo,
                    o.CustomerName,
                    o.StockCode,
                    o.ProductName,
                    c.CartonNo,
                    c.SSCC,
                    c.ActualQuantity,
                    o.ProductPerCarton
                FROM Cartons c
                INNER JOIN ProductCodes pc ON pc.CartonId = c.Id
                LEFT JOIN Users u ON pc.ScannedBy = u.Id
                LEFT JOIN Orders o ON pc.OrderId = o.Id
                WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                ORDER BY pc.ScannedAt DESC
                LIMIT 1
            ) last_scan ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(pc.Id) AS ItemCount
                FROM Cartons c
                INNER JOIN ProductCodes pc ON pc.CartonId = c.Id
                WHERE c.StationId = s.Id AND pc.Status != 'Uploaded' AND pc.ScannedAt >= CURRENT_DATE
            ) today_scans ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(pc.Id) AS ItemCount
                FROM Cartons c
                INNER JOIN ProductCodes pc ON pc.CartonId = c.Id
                WHERE c.StationId = s.Id AND pc.ScannedAt >= (NOW() - INTERVAL '1 HOUR')
            ) hour_scans ON true
            LEFT JOIN LATERAL (
                SELECT 
                    EXTRACT(EPOCH FROM (times.t1 - times.t2)) AS PaceSec
                FROM (
                    SELECT 
                        pc.ScannedAt AS t1,
                        LEAD(pc.ScannedAt) OVER (ORDER BY pc.ScannedAt DESC) AS t2
                    FROM Cartons c
                    INNER JOIN ProductCodes pc ON pc.CartonId = c.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded' AND pc.ScannedAt IS NOT NULL
                    ORDER BY pc.ScannedAt DESC
                    LIMIT 2
                ) times
                WHERE times.t2 IS NOT NULL AND times.t1 >= (NOW() - INTERVAL '5 MINUTES')
            ) st_pace ON true
            WHERE s.IsActive = true
            ORDER BY s.Name ASC;";

        var stationsRaw = (await connection.QueryAsync<dynamic>(
            new CommandDefinition(stationsSql, cancellationToken: cancellationToken))).ToList();

        var stationList = new List<LiveStationDto>();
        int activeStationCount = 0;
        var cutoff = DateTime.UtcNow.AddMinutes(-10);

        foreach (var x in stationsRaw)
        {
            DateTime? lastScan = x.lastscannedat != null ? (DateTime?)x.lastscannedat : null;
            bool isActive = lastScan.HasValue && lastScan.Value >= cutoff;

            if (isActive) activeStationCount++;

            double stPace = x.stationpacesecondsperitem != null ? Convert.ToDouble(x.stationpacesecondsperitem) : 0;
            if (stPace < 0) stPace = 0;

            stationList.Add(new LiveStationDto
            {
                StationId = (Guid)x.stationid,
                StationName = (string)x.stationname,
                StationCode = (string)x.stationcode,
                Status = isActive ? "Active" : "Idle",
                OperatorName = (string?)x.operatorname ?? "Operatör",
                CurrentOrderNo = (string?)x.currentorderno ?? "-",
                CurrentStockCode = (string?)x.currentstockcode ?? "-",
                CurrentProductName = (string?)x.currentproductname ?? "-",
                CurrentCartonNo = (string?)x.currentcartonno ?? "-",
                CurrentCartonSscc = (string?)x.currentcartonsscc ?? "-",
                CartonCurrentQty = x.cartoncurrentqty != null ? Convert.ToInt32(x.cartoncurrentqty) : 0,
                CartonTargetQty = x.cartontargetqty != null ? Math.Max(1, Convert.ToInt32(x.cartontargetqty)) : 1,
                LastScannedAt = lastScan,
                ItemsScannedLastHour = x.itemsscannedlasthour != null ? Convert.ToInt32(x.itemsscannedlasthour) : 0,
                ItemsScannedToday = x.itemsscannedtoday != null ? Convert.ToInt32(x.itemsscannedtoday) : 0,
                StationPaceSecondsPerItem = Math.Round(stPace, 1)
            });
        }

        // 3. Stats for today
        const string todaySql = @"
            SELECT 
                (SELECT COUNT(*) FROM ProductCodes WHERE Status != 'Uploaded' AND ScannedAt >= CURRENT_DATE) AS TodayItems,
                (SELECT COUNT(*) FROM Cartons WHERE ClosedAt >= CURRENT_DATE OR (Status IN ('Closed', 'Printed', 'Palletized', 'Shipped') AND CreatedAt >= CURRENT_DATE)) AS TodayCartons;";

        var todayStats = await connection.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(todaySql, cancellationToken: cancellationToken));

        int todayItems = todayStats != null ? Convert.ToInt32(todayStats.todayitems) : 0;
        int todayCartons = todayStats != null ? Convert.ToInt32(todayStats.todaycartons) : 0;

        // 4. Truly Instant Pace (Difference between last 2 scans globally)
        double instantPaceSec = 0;
        const string instantSql = @"
            SELECT ScannedAt 
            FROM ProductCodes 
            WHERE Status != 'Uploaded' AND ScannedAt IS NOT NULL 
            ORDER BY ScannedAt DESC 
            LIMIT 2;";

        var recentTimes = (await connection.QueryAsync<DateTime>(
            new CommandDefinition(instantSql, cancellationToken: cancellationToken))).ToList();

        if (recentTimes.Count >= 2)
        {
            var latest = recentTimes[0];
            var previous = recentTimes[1];
            if (latest >= DateTime.UtcNow.AddMinutes(-3))
            {
                double diffSec = (latest - previous).TotalSeconds;
                if (diffSec >= 0)
                {
                    instantPaceSec = Math.Round(diffSec, 1);
                }
            }
        }

        // 5. Average Pace over the last 30 minutes
        double avg30MinSec = 0;
        const string pace30Sql = @"
            SELECT 
                COUNT(Id) AS ScannedCount,
                EXTRACT(EPOCH FROM (MAX(ScannedAt) - MIN(ScannedAt))) AS TotalSec
            FROM ProductCodes 
            WHERE Status != 'Uploaded' AND ScannedAt >= (NOW() - INTERVAL '30 MINUTES');";

        var pace30Res = await connection.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(pace30Sql, cancellationToken: cancellationToken));

        if (pace30Res != null && pace30Res.scannedcount != null)
        {
            int cnt = Convert.ToInt32(pace30Res.scannedcount);
            if (cnt > 1 && pace30Res.totalsec != null)
            {
                double totalSec = Convert.ToDouble(pace30Res.totalsec);
                if (totalSec > 0)
                {
                    avg30MinSec = Math.Round(totalSec / (cnt - 1), 1);
                }
            }
        }

        // 6. Calculate Production Efficiency % (Filtering out idle gaps > 15s)
        double productionEfficiencyPct = 100.0;
        const string activeGapsSql = @"
            WITH scan_diffs AS (
                SELECT 
                    ScannedAt,
                    EXTRACT(EPOCH FROM (ScannedAt - LAG(ScannedAt) OVER (ORDER BY ScannedAt ASC))) AS DiffSec
                FROM ProductCodes
                WHERE Status != 'Uploaded' AND ScannedAt >= (NOW() - INTERVAL '30 MINUTES')
            )
            SELECT 
                COUNT(*) AS ActiveScanCount,
                AVG(DiffSec) AS AvgActivePaceSec
            FROM scan_diffs
            WHERE DiffSec IS NOT NULL AND DiffSec > 0 AND DiffSec <= 15;";

        var efficiencyRes = await connection.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(activeGapsSql, cancellationToken: cancellationToken));

        if (efficiencyRes != null && efficiencyRes.activescancount != null && Convert.ToInt32(efficiencyRes.activescancount) > 0)
        {
            double avgActivePace = Convert.ToDouble(efficiencyRes.avgactivepacesec);
            if (avgActivePace > 0)
            {
                // Ideal benchmark pace = 2.5 seconds per item
                double idealPaceSec = 2.5;
                productionEfficiencyPct = Math.Min(100.0, Math.Round((idealPaceSec / avgActivePace) * 100.0, 1));
            }
        }
        else
        {
            // Fallback: If no scans in last 30 minutes, check active order completion %
            const string orderEffSql = @"
                SELECT 
                    SUM(ExpectedQuantity) AS TotalTarget,
                    SUM((SELECT COUNT(*) FROM ProductCodes pc WHERE pc.OrderId = o.Id AND pc.Status = 'Scanned')) AS TotalScanned
                FROM Orders o
                WHERE o.Status = 'Active';";
            var orderEffRes = await connection.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(orderEffSql, cancellationToken: cancellationToken));
            if (orderEffRes != null && orderEffRes.totaltarget != null && Convert.ToInt32(orderEffRes.totaltarget) > 0)
            {
                int target = Convert.ToInt32(orderEffRes.totaltarget);
                int scanned = Convert.ToInt32(orderEffRes.totalscanned ?? 0);
                productionEfficiencyPct = Math.Min(100.0, Math.Round((double)scanned / target * 100.0, 1));
            }
        }

        double itemsPerMin = instantPaceSec > 0 ? Math.Round(60.0 / instantPaceSec, 1) : 0;

        return new DashboardLiveFeedDto
        {
            ActiveStationCount = activeStationCount,
            TodayTotalItems = todayItems,
            TodayTotalCartons = todayCartons,
            CurrentPaceItemsPerMin = itemsPerMin,
            CurrentPaceSecondsPerItem = instantPaceSec,
            AvgPace30MinSecondsPerItem = avg30MinSec,
            ProductionEfficiencyPct = productionEfficiencyPct,
            ActiveStations = stationList,
            RecentScansFeed = feedItems
        };
    }
}
