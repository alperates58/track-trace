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
            LEFT JOIN Stations s ON pc.StationId = s.Id
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
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                ) AS LastScannedAt,
                (
                    SELECT COUNT(pc.Id) 
                    FROM ProductCodes pc 
                    WHERE pc.StationId = s.Id AND pc.ScannedAt >= (NOW() - INTERVAL '1 HOUR')
                ) AS ItemsScannedLastHour,
                (
                    SELECT u.Name
                    FROM ProductCodes pc
                    LEFT JOIN Users u ON pc.ScannedBy = u.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS OperatorName,
                (
                    SELECT o.OrderNo
                    FROM ProductCodes pc
                    LEFT JOIN Orders o ON pc.OrderId = o.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentOrderNo,
                (
                    SELECT o.StockCode
                    FROM ProductCodes pc
                    LEFT JOIN Orders o ON pc.OrderId = o.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentStockCode,
                (
                    SELECT c.CartonNo
                    FROM ProductCodes pc
                    LEFT JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentCartonNo,
                (
                    SELECT c.SSCC
                    FROM ProductCodes pc
                    LEFT JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CurrentCartonSscc,
                (
                    SELECT c.ActualQuantity
                    FROM ProductCodes pc
                    LEFT JOIN Cartons c ON pc.CartonId = c.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
                    ORDER BY pc.ScannedAt DESC LIMIT 1
                ) AS CartonCurrentQty,
                (
                    SELECT COALESCE(o.ProductPerCarton, 1)
                    FROM ProductCodes pc
                    LEFT JOIN Orders o ON pc.OrderId = o.Id
                    WHERE pc.StationId = s.Id AND pc.Status != 'Uploaded'
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
                (SELECT COUNT(*) FROM Cartons WHERE CreatedAt >= CURRENT_DATE) AS TodayCartons,
                (SELECT COUNT(*) FROM ProductCodes WHERE Status != 'Uploaded' AND ScannedAt >= (NOW() - INTERVAL '5 MINUTES')) AS Recent5MinItems;";

        var todayStats = await connection.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(todaySql, cancellationToken: cancellationToken));

        int todayItems = todayStats != null ? Convert.ToInt32(todayStats.todayitems) : 0;
        int todayCartons = todayStats != null ? Convert.ToInt32(todayStats.todaycartons) : 0;
        int recent5Min = todayStats != null ? Convert.ToInt32(todayStats.recent5minitems) : 0;
        double currentPace = Math.Round(recent5Min / 5.0, 1);
        
        double currentPaceSecPerItem = 0;
        if (recent5Min > 0)
        {
            currentPaceSecPerItem = Math.Round(300.0 / recent5Min, 1);
        }
        else
        {
            // Fallback: Check average interval between last 20 scans in the system
            const string paceSql = @"
                SELECT 
                    EXTRACT(EPOCH FROM (MAX(ScannedAt) - MIN(ScannedAt))) AS TotalSec,
                    COUNT(Id) AS ScannedCount
                FROM (
                    SELECT Id, ScannedAt 
                    FROM ProductCodes 
                    WHERE Status != 'Uploaded' AND ScannedAt IS NOT NULL 
                    ORDER BY ScannedAt DESC 
                    LIMIT 20
                ) sub;";
            var paceRes = await connection.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(paceSql, cancellationToken: cancellationToken));
            if (paceRes != null && paceRes.scannedcount != null && Convert.ToInt32(paceRes.scannedcount) > 1)
            {
                double totalSec = Convert.ToDouble(paceRes.totalsec);
                int cnt = Convert.ToInt32(paceRes.scannedcount) - 1;
                if (totalSec > 0 && cnt > 0)
                {
                    currentPaceSecPerItem = Math.Round(totalSec / cnt, 1);
                }
            }
        }

        return new DashboardLiveFeedDto
        {
            ActiveStationCount = activeStationCount,
            TodayTotalItems = todayItems,
            TodayTotalCartons = todayCartons,
            CurrentPaceItemsPerMin = currentPace,
            CurrentPaceSecondsPerItem = currentPaceSecPerItem,
            ActiveStations = stationList,
            RecentScansFeed = feedItems
        };
    }
}
