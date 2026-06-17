using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Reports;

public record GetDashboardSummaryQuery : IRequest<DashboardSummaryDto>;

public record BarcodeSearchQuery(string RawCode) : IRequest<BarcodeSearchResultDto?>;

public record GetSystemInfoQuery(string AppVersion, string BuildDate, string GitCommitSha, string FrontendApiUrl) : IRequest<SystemInfoDto>;

public record GetPrintJobsQuery(int PageNumber = 1, int PageSize = 10) : IRequest<(IEnumerable<PrintJobDto> Items, int TotalCount)>;

public class ReportHandlers :
    IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>,
    IRequestHandler<BarcodeSearchQuery, BarcodeSearchResultDto?>,
    IRequestHandler<GetSystemInfoQuery, SystemInfoDto>,
    IRequestHandler<GetPrintJobsQuery, (IEnumerable<PrintJobDto> Items, int TotalCount)>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public ReportHandlers(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string sql = @"
            SELECT 
                (SELECT COUNT(*) FROM Orders WHERE Status = 'Active') as ActiveOrders,
                (SELECT COUNT(*) FROM Cartons WHERE Status = 'Open') as OpenCartons,
                (SELECT COUNT(*) FROM Pallets WHERE Status = 'Open') as OpenPallets,
                (SELECT COUNT(*) FROM ProductCodes WHERE Status = 'Scanned' AND ScannedAt >= CURRENT_DATE) as ScannedToday,
                (SELECT COUNT(*) FROM Cartons WHERE CreatedAt >= CURRENT_DATE) as CartonsToday,
                (SELECT COUNT(*) FROM Pallets WHERE CreatedAt >= CURRENT_DATE) as PalletsToday";

        var stats = await connection.QueryFirstOrDefaultAsync<dynamic>(sql);

        // Fetch recent activities
        const string actSql = @"
            SELECT al.Action, al.EntityName, al.CreatedAt, u.Name as UserName
            FROM AuditLogs al
            LEFT JOIN Users u ON al.UserId = u.Id
            ORDER BY al.CreatedAt DESC
            LIMIT 10";

        var activities = await connection.QueryAsync<dynamic>(actSql);

        var recentActivities = activities.Select(x => {
            string userName = x.username ?? "Sistem";
            string action = x.action;
            string entity = x.entityname;
            string message = $"{userName} tarafından {entity} tablosunda '{action}' işlemi yapıldı.";
            return new RecentActivityDto(message, (DateTime)x.createdat, userName);
        }).ToList();

        return new DashboardSummaryDto(
            stats == null ? 0 : (int)stats.activeorders,
            stats == null ? 0 : (int)stats.opencartons,
            stats == null ? 0 : (int)stats.openpallets,
            stats == null ? 0 : Convert.ToInt32(stats.scannedtoday),
            stats == null ? 0 : Convert.ToInt32(stats.cartonstoday),
            stats == null ? 0 : Convert.ToInt32(stats.palletstoday),
            recentActivities
        );
    }

    private static string ExtractSscc(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return query;
        
        int idx = query.IndexOf("[00]");
        if (idx >= 0 && query.Length >= idx + 4 + 18)
        {
            return query.Substring(idx + 4, 18);
        }

        idx = query.IndexOf("(00)");
        if (idx >= 0 && query.Length >= idx + 4 + 18)
        {
            return query.Substring(idx + 4, 18);
        }

        if (query.Contains("|"))
        {
            var parts = query.Split('|');
            foreach (var part in parts)
            {
                if (part.StartsWith("[00]") && part.Length >= 22)
                    return part.Substring(4, 18);
                if (part.StartsWith("(00)") && part.Length >= 22)
                    return part.Substring(4, 18);
            }
        }

        var match20 = System.Text.RegularExpressions.Regex.Match(query, @"\b00(\d{18})\b");
        if (match20.Success)
        {
            return match20.Groups[1].Value;
        }

        var match = System.Text.RegularExpressions.Regex.Match(query, @"\b\d{18}\b");
        if (match.Success)
        {
            return match.Value;
        }

        return query;
    }

    public async Task<BarcodeSearchResultDto?> Handle(BarcodeSearchQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT pc.RawCode, pc.Gtin, pc.SerialNo, pc.Status, pc.ScannedAt, u.Name as ScannedBy,
                   o.OrderNo, o.CustomerName, o.ProductName,
                   c.CartonNo, c.SSCC as CartonSSCC,
                   p.PalletNo, p.SSCC as PalletSSCC
            FROM ProductCodes pc
            INNER JOIN Orders o ON pc.OrderId = o.Id
            LEFT JOIN Users u ON pc.ScannedBy = u.Id
            LEFT JOIN Cartons c ON pc.CartonId = c.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE pc.RawCode = @RawCode";

        var x = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { RawCode = request.RawCode });
        if (x != null)
        {
            return new BarcodeSearchResultDto(
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
                (string?)x.palletno,
                (string?)x.palletsscc
            );
        }

        // Try searching for Carton if not found as a product code
        string cleanSearch = ExtractSscc(request.RawCode);
        const string cartonSql = @"
            SELECT c.Id, c.CartonNo, c.SSCC as CartonSSCC, c.Status, c.CreatedAt,
                   o.OrderNo, o.CustomerName, o.ProductName, o.Gtin,
                   p.PalletNo, p.SSCC as PalletSSCC
            FROM Cartons c
            INNER JOIN Orders o ON c.OrderId = o.Id
            LEFT JOIN PalletCartons plc ON c.Id = plc.CartonId
            LEFT JOIN Pallets p ON plc.PalletId = p.Id
            WHERE c.SSCC = @Search OR c.CartonNo = @Search";

        var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(cartonSql, new { Search = cleanSearch });
        if (carton != null)
        {
            const string itemsSql = "SELECT RawCode FROM ProductCodes WHERE CartonId = @CartonId ORDER BY ScannedAt DESC";
            var items = await connection.QueryAsync<string>(itemsSql, new { CartonId = (Guid)carton.id });

            return new BarcodeSearchResultDto(
                RawCode: request.RawCode,
                Gtin: (string?)carton.gtin,
                SerialNo: null,
                Status: (string)carton.status,
                ScannedAt: (DateTime)carton.createdat,
                ScannedBy: null,
                OrderNo: (string?)carton.orderno,
                CustomerName: (string?)carton.customername,
                ProductName: (string?)carton.productname,
                CartonNo: (string?)carton.cartonno,
                CartonSSCC: (string?)carton.cartonsscc,
                PalletNo: (string?)carton.palletno,
                PalletSSCC: (string?)carton.palletsscc,
                CartonItems: items
            );
        }

        return null;
    }

    public async Task<SystemInfoDto> Handle(GetSystemInfoQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        string dbConnectivity = "Sağlıklı";
        int totalOrders = 0;
        int totalCodes = 0;

        try
        {
            totalOrders = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Orders");
            totalCodes = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM ProductCodes");
        }
        catch (Exception)
        {
            dbConnectivity = "Hatalı / Bağlantı Yok";
        }

        return new SystemInfoDto(
            request.AppVersion,
            request.BuildDate,
            request.GitCommitSha,
            "Aktif",
            dbConnectivity,
            request.FrontendApiUrl,
            totalOrders,
            totalCodes
        );
    }

    public async Task<(IEnumerable<PrintJobDto> Items, int TotalCount)> Handle(GetPrintJobsQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string sql = @"
            SELECT pj.*, u.Name as PrintedByName,
                   CASE 
                     WHEN pj.LabelType = 'Carton' THEN (SELECT CartonNo FROM Cartons WHERE Id = pj.EntityId)
                     ELSE (SELECT PalletNo FROM Pallets WHERE Id = pj.EntityId)
                   END as EntityNo
            FROM PrintJobs pj
            LEFT JOIN Users u ON pj.PrintedBy = u.Id
            ORDER BY pj.CreatedAt DESC
            LIMIT @Limit OFFSET @Offset";

        const string countSql = "SELECT COUNT(*) FROM PrintJobs";

        var items = await connection.QueryAsync<dynamic>(sql, new { Limit = request.PageSize, Offset = (request.PageNumber - 1) * request.PageSize });
        var totalCount = await connection.ExecuteScalarAsync<int>(countSql);

        var dtos = items.Select(x => new PrintJobDto(
            (Guid)x.id,
            (string)x.labeltype,
            (Guid)x.entityid,
            x.entityno ?? "Bilinmiyor",
            (string?)x.printedbyname,
            (int)x.printcount,
            (string)x.format,
            (DateTime)x.createdat
        ));

        return (dtos, totalCount);
    }
}
