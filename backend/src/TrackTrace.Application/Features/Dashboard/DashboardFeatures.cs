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
    public string? CurrentCartonNo { get; set; }
    public string? CurrentCartonSscc { get; set; }
    public int CartonCurrentQty { get; set; }
    public int CartonTargetQty { get; set; }
    public DateTime? LastScannedAt { get; set; }
    public int ItemsScannedLastHour { get; set; }
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
                (
                    SELECT MAX(pc.ScannedAt) 
                    FROM ProductCodes pc 
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                ) AS LastScannedAt,
                (
                    SELECT COUNT(pc.Id) 
                    FROM ProductCodes pc 
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE c.StationId = s.Id AND pc.ScannedAt >= (NOW() - INTERVAL '1 HOUR')
                ) AS ItemsScannedLastHour,
                (
                    SELECT u.Name
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    LEFT JOIN Users u ON pc.ScannedBy = u.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS OperatorName,
                (
                    SELECT o.OrderNo
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    LEFT JOIN Orders o ON pc.OrderId = o.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentOrderNo,
                (
                    SELECT o.StockCode
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    LEFT JOIN Orders o ON pc.OrderId = o.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentStockCode,
                (
                    SELECT c.CartonNo
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentCartonNo,
                (
                    SELECT c.SSCC
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentCartonSscc,
                (
                    SELECT c.ActualQuantity
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CartonCurrentQty,
                (
                    SELECT COALESCE(o.ProductPerCarton, 1)
                    FROM ProductCodes pc
                    INNER JOIN Cartons c ON pc.CartonId = c.Id
                    LEFT JOIN Orders o ON pc.OrderId = o.Id
                    WHERE c.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CartonTargetQty
            FROM Stations s
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

            stationList.Add(new LiveStationDto
            {
                StationId = (Guid)x.stationid,
                StationName = (string)x.stationname,
                StationCode = (string)x.stationcode,
                Status = isActive ? "Active" : "Idle",
                OperatorName = (string?)x.operatorname ?? "Operatör",
                CurrentOrderNo = (string?)x.currentorderno ?? "-",
                CurrentStockCode = (string?)x.currentstockcode ?? "-",
                CurrentCartonNo = (string?)x.currentcartonno ?? "-",
                CurrentCartonSscc = (string?)x.currentcartonsscc ?? "-",
                CartonCurrentQty = x.cartoncurrentqty != null ? Convert.ToInt32(x.cartoncurrentqty) : 0,
                CartonTargetQty = x.cartontargetqty != null ? Math.Max(1, Convert.ToInt32(x.cartontargetqty)) : 1,
                LastScannedAt = lastScan,
                ItemsScannedLastHour = x.itemsscannedlasthour != null ? Convert.ToInt32(x.itemsscannedlasthour) : 0
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

        // 4. Truly Instant Pace (Difference between last 2 scans)
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
            // Only count as active instant scan if latest scan was within the last 3 minutes
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

        double itemsPerMin = instantPaceSec > 0 ? Math.Round(60.0 / instantPaceSec, 1) : 0;

        return new DashboardLiveFeedDto
        {
            ActiveStationCount = activeStationCount,
            TodayTotalItems = todayItems,
            TodayTotalCartons = todayCartons,
            CurrentPaceItemsPerMin = itemsPerMin,
            CurrentPaceSecondsPerItem = instantPaceSec,
            AvgPace30MinSecondsPerItem = avg30MinSec,
            ActiveStations = stationList,
            RecentScansFeed = feedItems
        };
    }
}
