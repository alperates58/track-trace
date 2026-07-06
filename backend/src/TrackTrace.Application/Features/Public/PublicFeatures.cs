using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Public;

public record VerifyCodeQuery(string Code) : IRequest<VerifyCodeResponse>;

public record VerifyCodeResponse(
    bool IsFound,
    string? Type, // Carton or Pallet
    string? CodeNo, // CartonNo or PalletNo
    string? OrderNo,
    string? ProductName,
    int ActualQuantity,
    int TargetQuantity,
    string? Status, // Hazır, Dolduruluyor, Tamamlandı, Paletlendi, İptal vb.
    DateTime? CreatedAt
);

public class VerifyCodeQueryHandler : IRequestHandler<VerifyCodeQuery, VerifyCodeResponse>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public VerifyCodeQueryHandler(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<VerifyCodeResponse> Handle(VerifyCodeQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        var code = Gs1AutoHelper.ExtractSscc(request.Code);

        // Check if Pallet
        var pallet = await connection.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT p.PalletNo, p.SSCC, p.Status, p.CreatedAt, p.CartonCount, p.TotalProductCount, o.OrderNo, o.ProductName
            FROM Pallets p
            JOIN Orders o ON p.OrderId = o.Id
            WHERE p.SSCC = @Code OR p.PalletNo = @Code", new { Code = code });

        if (pallet != null)
        {
            return new VerifyCodeResponse(
                true,
                "Pallet",
                (string)pallet.palletno,
                (string)pallet.orderno,
                (string?)pallet.productname,
                Convert.ToInt32(pallet.totalproductcount),
                Convert.ToInt32(pallet.totalproductcount), // target qty for pallet is dynamic
                TranslatePalletStatus((string)pallet.status),
                (DateTime)pallet.createdat
            );
        }

        // Check if Carton
        var carton = await connection.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT c.CartonNo, c.SSCC, c.ActualQuantity, c.TargetQuantity, c.Status, c.CreatedAt, o.OrderNo, o.ProductName
            FROM Cartons c
            JOIN Orders o ON c.OrderId = o.Id
            WHERE c.SSCC = @Code OR c.CartonNo = @Code", new { Code = code });

        if (carton != null)
        {
            return new VerifyCodeResponse(
                true,
                "Carton",
                (string)carton.cartonno,
                (string)carton.orderno,
                (string?)carton.productname,
                (int)carton.actualquantity,
                (int)carton.targetquantity,
                TranslateCartonStatus((string)carton.status),
                (DateTime)carton.createdat
            );
        }

        return new VerifyCodeResponse(false, null, null, null, null, 0, 0, null, null);
    }

    private string TranslateCartonStatus(string status)
    {
        return status switch
        {
            "PrePrinted" => "Hazır (Etiket Basıldı)",
            "Open" => "Dolduruluyor",
            "Filling" => "Dolduruluyor",
            "Closed" => "Tamamlandı (Kapalı)",
            "Printed" => "Tamamlandı (Kapalı)",
            "Palletized" => "Paletlendi",
            "Void" => "İptal Edildi",
            _ => status
        };
    }

    private string TranslatePalletStatus(string status)
    {
        return status switch
        {
            "Open" => "Oluşturuluyor",
            "Closed" => "Tamamlandı",
            "Void" => "İptal Edildi",
            _ => status
        };
    }
}
