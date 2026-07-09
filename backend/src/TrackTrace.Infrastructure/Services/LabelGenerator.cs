using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using ZXing;
using ZXing.Datamatrix;
using ZXing.SkiaSharp;
using SkiaSharp;
using Microsoft.Extensions.Configuration;

namespace TrackTrace.Infrastructure.Services;

public class LabelGenerator : ILabelGenerator
{
    private readonly string _frontendUrl;

    public LabelGenerator(IConfiguration configuration)
    {
        _frontendUrl = configuration["FRONTEND_URL"] ?? "https://track.alperates.com.tr";
    }

    public byte[] GenerateTestPdfLabel()
    {
        using var stream = new MemoryStream();
        
        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(100, 80, Unit.Millimetre);
                page.Margin(4, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(10));

                page.Content().Border(1).BorderColor(Colors.Black).Padding(6).Column(col =>
                {
                    col.Spacing(4);
                    col.Item().AlignCenter().Text("TEST ETİKETİ / TEST LABEL").Bold().FontSize(14);
                    col.Item().LineHorizontal(1f);
                    
                    col.Item().PaddingTop(10).AlignCenter().Text("Bağlantı: Başarılı").Bold().FontSize(12).FontColor(Colors.Green.Darken2);
                    col.Item().AlignCenter().Text($"Tarih: {DateTime.UtcNow.AddHours(3):dd.MM.yyyy HH:mm:ss}").FontSize(10);
                    
                    col.Item().PaddingTop(10).AlignCenter().Text("Track & Trace Termal Yazıcı Testi").FontSize(10).FontColor(Colors.Grey.Darken2);
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public byte[] GenerateCartonPdfLabel(CartonDto carton, OrderDto order)
    {
        string qtyText = carton.Mode == "PrePrinted" 
            ? $"{carton.TargetQuantity} / {carton.TargetQuantity}" 
            : $"{carton.ActualQuantity} / {carton.TargetQuantity}";

        // Generate QR code bytes using QRCoder pointing to frontend URL for customer scans
        byte[] qrCodeImageBytes = GenerateQRCodeBytes($"{_frontendUrl}/?code={carton.SSCC}");

        using var stream = new MemoryStream();
        
        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(100, 80, Unit.Millimetre);
                page.Margin(4, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(10));

                page.Content().Border(1).BorderColor(Colors.Black).Padding(4).Column(col =>
                {
                    col.Spacing(2);

                    col.Item().AlignCenter().Text("KOLİ ETİKETİ / CARTON LABEL").Bold().FontSize(11);
                    col.Item().LineHorizontal(0.5f);

                    col.Item().Row(row =>
                    {
                        // Left Column: Details (60% width)
                        row.RelativeItem(3).Column(details =>
                        {
                            details.Spacing(0);

                            // Müşteri / Customer
                            details.Item().Column(c =>
                            {
                                c.Item().Text("Müşteri / Customer:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                c.Item().Text(order.CustomerName).Bold().FontSize(9);
                            });

                            // Sipariş No & Stok Kodu
                            details.Item().Row(r =>
                            {
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Sipariş No / Order No:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(order.OrderNo).FontSize(8);
                                });
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Stok Kodu / Stock Code:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(order.StockCode ?? "-").FontSize(8);
                                });
                            });

                            // Ürün Adı / Product Name
                            details.Item().Column(c =>
                            {
                                c.Item().Text("Ürün Adı / Product Name:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                c.Item().Text(order.ProductName ?? "-").FontSize(8);
                            });

                            // İş Emri No & Adet / Quantity
                            details.Item().Row(r =>
                            {
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("İş Emri No:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(order.GTIN).FontSize(8);
                                });
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Adet / Quantity:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(qtyText).Bold().FontSize(9);
                                });
                            });

                            // Koli No & Tarih / Date
                            details.Item().Row(r =>
                            {
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Koli No / Carton No:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(carton.CartonNo).FontSize(7);
                                });
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Tarih / Date:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(carton.CreatedAt.AddHours(3).ToString("dd.MM.yyyy HH:mm")).FontSize(7);
                                });
                            });

                            // İstasyon & Kullanıcı
                            details.Item().Row(r =>
                            {
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("İstasyon / Station:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(carton.StationName ?? "-").FontSize(7);
                                });
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Kullanıcı / User:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(carton.UserName ?? "-").FontSize(7);
                                });
                            });
                        });

                        // Gutter
                        row.ConstantItem(12);

                        // Right Column: SSCC Barcode (40% width)
                        row.RelativeItem(2).AlignMiddle().Column(barcode =>
                        {
                            barcode.Spacing(4);
                            barcode.Item().AlignCenter().Text("SSCC BARCODE").Bold().FontSize(8).FontColor(Colors.Grey.Darken3);
                            barcode.Item().AlignCenter().Width(75).Height(75).Image(qrCodeImageBytes);
                            barcode.Item().AlignCenter().Text($"(00){carton.SSCC}").Bold().FontSize(9);
                            if (carton.PrintCount > 0)
                            {
                                barcode.Item().AlignCenter().Text(carton.PrintCount > 1 ? $"Tekrar Baskı: {carton.PrintCount}" : $"Baskı: {carton.PrintCount}").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                            }
                        });
                    });
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public byte[] GenerateBatchCartonPdfLabel(System.Collections.Generic.IEnumerable<CartonDto> cartons, OrderDto order)
    {
        using var stream = new MemoryStream();
        
        Document.Create(container =>
        {
            foreach(var carton in cartons)
            {
                string qtyText = carton.Mode == "PrePrinted" 
                    ? $"{carton.TargetQuantity} / {carton.TargetQuantity}" 
                    : $"{carton.ActualQuantity} / {carton.TargetQuantity}";

                byte[] qrCodeImageBytes = GenerateQRCodeBytes($"{_frontendUrl}/?code={carton.SSCC}");
                container.Page(page =>
                {
                    page.Size(100, 80, Unit.Millimetre);
                    page.Margin(4, Unit.Millimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(10));

                    page.Content().Border(1).BorderColor(Colors.Black).Padding(4).Column(col =>
                    {
                        col.Spacing(2);

                        col.Item().AlignCenter().Text("KOLİ ETİKETİ / CARTON LABEL").Bold().FontSize(11);
                        col.Item().LineHorizontal(0.5f);

                        col.Item().Row(row =>
                        {
                            row.RelativeItem(3).Column(details =>
                            {
                                details.Spacing(0);

                                details.Item().Column(c =>
                                {
                                    c.Item().Text("Müşteri / Customer:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(order.CustomerName).Bold().FontSize(9);
                                });

                                details.Item().Row(r =>
                                {
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("Sipariş No / Order No:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(order.OrderNo).FontSize(8);
                                    });
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("Stok Kodu / Stock Code:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(order.StockCode ?? "-").FontSize(8);
                                    });
                                });

                                details.Item().Column(c =>
                                {
                                    c.Item().Text("Ürün Adı / Product Name:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(order.ProductName ?? "-").FontSize(8);
                                });

                                details.Item().Row(r =>
                                {
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("İş Emri No:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(order.GTIN).FontSize(8);
                                    });
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("Adet / Quantity:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(qtyText).Bold().FontSize(9);
                                    });
                                });

                                details.Item().Row(r =>
                                {
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("Koli No / Carton No:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(carton.CartonNo).FontSize(7);
                                    });
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("Tarih / Date:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(carton.CreatedAt.AddHours(3).ToString("dd.MM.yyyy HH:mm")).FontSize(7);
                                    });
                                });

                                details.Item().Row(r =>
                                {
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("İstasyon / Station:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(carton.StationName ?? "-").FontSize(7);
                                    });
                                    r.RelativeItem().Column(c =>
                                    {
                                        c.Item().Text("Kullanıcı / User:").Bold().FontSize(6).FontColor(Colors.Grey.Darken3);
                                        c.Item().Text(carton.UserName ?? "-").FontSize(7);
                                    });
                                });
                            });

                            row.ConstantItem(12);

                            row.RelativeItem(2).AlignMiddle().Column(barcode =>
                            {
                                barcode.Spacing(4);
                                barcode.Item().AlignCenter().Text("SSCC BARCODE").Bold().FontSize(8).FontColor(Colors.Grey.Darken3);
                                barcode.Item().AlignCenter().Width(75).Height(75).Image(qrCodeImageBytes);
                                barcode.Item().AlignCenter().Text($"(00){carton.SSCC}").Bold().FontSize(9);
                                if (carton.PrintCount > 0)
                                {
                                    barcode.Item().AlignCenter().Text(carton.PrintCount > 1 ? $"Tekrar Baskı: {carton.PrintCount}" : $"Baskı: {carton.PrintCount}").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                }
                            });
                        });
                    });
                });
            }
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public string GenerateCartonZplLabel(CartonDto carton, OrderDto order)
    {
        string printText = carton.PrintCount > 0 ? (carton.PrintCount > 1 ? $"Tekrar Baski: {carton.PrintCount}" : $"Baski: {carton.PrintCount}") : "";
        string qtyText = carton.Mode == "PrePrinted" 
            ? $"{carton.TargetQuantity} / {carton.TargetQuantity}" 
            : $"{carton.ActualQuantity} / {carton.TargetQuantity}";

        return $@"^XA
^CI28
^PW800
^LL640
^LH0,0
^FO40,40^A0N,36,36^FDKOLI ETİKETİ / CARTON LABEL^FS
^FO40,90^GB720,3,3^FS
^FO40,110^A0N,18,18^FDMüşteri / Customer:^FS
^FO40,130^A0N,24,24^FB440,1,0,L^FD{order.CustomerName}^FS
^FO40,165^A0N,18,18^FDSipariş No / Order No: {order.OrderNo}^FS
^FO40,195^A0N,18,18^FDStok Kodu / Stock Code: {order.StockCode ?? "-"}^FS
^FO40,225^A0N,18,18^FDÜrün Adı / Product Name:^FS
^FO40,245^A0N,20,20^FB440,2,0,L^FD{order.ProductName ?? "-"}^FS
^FO40,295^A0N,18,18^FDiş Emri No: {order.GTIN}^FS
^FO40,325^A0N,22,22^FDAdet / Quantity: {qtyText}^FS
^FO40,355^A0N,18,18^FDKoli No / Carton No: {carton.CartonNo}^FS
^FO40,390^A0N,18,18^FDTarih / Date: {carton.CreatedAt.AddHours(3):dd.MM.yyyy HH:mm}^FS
^FO40,420^A0N,18,18^FDIstasyon: {carton.StationName ?? "-"}  Kullanici: {carton.UserName ?? "-"}^FS
^FO490,110^GB3,310,3^FS
^FO500,110^A0N,20,20^FB280,1,0,C^FDSSCC BARCODE^FS
^FO525,150^BQN,2,7^FDQA,{_frontendUrl}/?code={carton.SSCC}^FS
^FO500,390^A0N,20,20^FB280,1,0,C^FD(00){carton.SSCC}^FS
^FO600,420^A0N,18,18^FD{printText}^FS
^XZ";
    }

    public string GenerateCartonPplbLabel(CartonDto carton, OrderDto order)
    {
        var customerLines = WrapPplbText(order.CustomerName, 30, 2).ToArray();
        var productLines = WrapPplbText(order.ProductName ?? "-", 31, 2).ToArray();
        var stockCode = ToPplbText(order.StockCode ?? "-");
        var ssccData = OnlyBarcodeSafeDigits(carton.SSCC);
        var ssccLines = SplitFixed($"(00){ssccData}", 16).ToArray();
        var qrData = $"{_frontendUrl}/?code={carton.SSCC}";
        var cartonSequence = GetCartonSequence(carton.CartonNo);
        string qtyText = carton.Mode == "PrePrinted" 
            ? $"{carton.TargetQuantity} / {carton.TargetQuantity}" 
            : $"{carton.ActualQuantity} / {carton.TargetQuantity}";

        var sb = new StringBuilder();
        AppendPplbHeader(sb, 800, 640);
        AddPplbBox(sb, 24, 24, 2, 776, 616);
        AddPplbLine(sb, 24, 86, 752, 2);
        AddPplbLine(sb, 540, 86, 2, 530);

        AddPplbText(sb, 238, 45, 4, "KOLI ETIKETI / CARTON LABEL");

        AddPplbText(sb, 48, 110, 2, "Musteri / Customer:");
        AddPplbText(sb, 48, 135, 3, customerLines.ElementAtOrDefault(0) ?? "-");
        if (customerLines.Length > 1) AddPplbText(sb, 48, 160, 3, customerLines[1]);

        AddPplbText(sb, 48, 192, 2, "Siparis No / Order No:");
        AddPplbText(sb, 48, 217, 3, ToPplbText(order.OrderNo));
        AddPplbText(sb, 300, 192, 2, "Stok Kodu / Stock Code:");
        AddPplbText(sb, 300, 217, 3, stockCode);

        AddPplbText(sb, 48, 262, 2, "Urun Adi / Product Name:");
        AddPplbText(sb, 48, 287, 3, productLines.ElementAtOrDefault(0) ?? "-");
        if (productLines.Length > 1) AddPplbText(sb, 48, 314, 3, productLines[1]);

        AddPplbText(sb, 48, 360, 2, "Is Emri No:");
        AddPplbText(sb, 48, 385, 3, ToPplbText(order.GTIN));
        AddPplbText(sb, 300, 360, 2, "Adet / Quantity:");
        AddPplbText(sb, 300, 385, 3, qtyText);

        AddPplbText(sb, 48, 440, 2, "Koli No / Carton No:");
        AddPplbText(sb, 48, 465, 3, ToPplbText(carton.CartonNo));
        AddPplbText(sb, 300, 440, 2, "Tarih / Date:");
        AddPplbText(sb, 300, 465, 2, $"{carton.CreatedAt.AddHours(3):dd.MM.yyyy HH:mm}");

        AddPplbText(sb, 48, 500, 2, $"Istasyon: {carton.StationName ?? "-"}  Kullanici: {carton.UserName ?? "-"}");

        AddPplbText(sb, 48, 535, 2, "No:");
        AddPplbText(sb, 90, 535, 2, cartonSequence);

        AddPplbText(sb, 590, 130, 2, "SSCC BARCODE");
        AddPplbQr(sb, 585, 185, qrData, 4);
        AddPplbText(sb, 572, 445, 2, ssccLines.ElementAtOrDefault(0) ?? $"(00){ssccData}");
        if (ssccLines.Length > 1) AddPplbText(sb, 602, 472, 2, ssccLines[1]);
        if (carton.PrintCount > 0)
        {
            string printText = carton.PrintCount > 1 ? $"Tekrar Baski: {carton.PrintCount}" : $"Baski: {carton.PrintCount}";
            AddPplbText(sb, 572, 500, 2, printText);
        }
        sb.AppendLine("P1");
        return sb.ToString();
    }

    public byte[] GeneratePalletPdfLabel(PalletDto pallet, OrderDto order, int cartonCount)
    {
        byte[] qrCodeImageBytes = GenerateQRCodeBytes($"{_frontendUrl}/?code={pallet.SSCC}");

        using var stream = new MemoryStream();
        
        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(4, 6, Unit.Inch);
                page.Margin(0.2f, Unit.Inch);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(10));

                page.Content().Border(1).BorderColor(Colors.Black).Padding(10).Column(col =>
                {
                    col.Spacing(8);

                    col.Item().AlignCenter().Text("PALET ETİKETİ / PALLET LABEL").Bold().FontSize(14);
                    col.Item().LineHorizontal(1);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Müşteri / Customer:").Bold().FontSize(8);
                            c.Item().Text(order.CustomerName).FontSize(11);
                        });
                    });

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Sipariş No / Order No:").Bold().FontSize(8);
                            c.Item().Text(order.OrderNo);
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Stok Kodu / Stock Code:").Bold().FontSize(8);
                            c.Item().Text(order.StockCode ?? "-");
                        });
                    });

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Ürün Adı / Product Name:").Bold().FontSize(8);
                            c.Item().Text(order.ProductName ?? "-");
                        });
                    });

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("İş Emri No:").Bold().FontSize(8);
                            c.Item().Text(order.GTIN).FontSize(11);
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Koli Sayısı / Carton Qty:").Bold().FontSize(8);
                            c.Item().Text($"{cartonCount} / {order.CartonPerPallet}").FontSize(12).Bold();
                        });
                    });

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Palet No / Pallet No:").Bold().FontSize(8);
                            c.Item().Text(pallet.PalletNo);
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Tarih / Date:").Bold().FontSize(8);
                            c.Item().Text(pallet.CreatedAt.AddHours(3).ToString("dd.MM.yyyy HH:mm"));
                        });
                    });

                    col.Item().LineHorizontal(1);

                    col.Item().AlignCenter().Column(c =>
                    {
                        c.Spacing(4);
                        c.Item().AlignCenter().Text("SSCC BARCODE").Bold().FontSize(8);
                        c.Item().AlignCenter().Width(120).Height(120).Image(qrCodeImageBytes);
                        c.Item().AlignCenter().Text($"(00){pallet.SSCC}").Bold().FontSize(11);
                    });
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public string GeneratePalletZplLabel(PalletDto pallet, OrderDto order, int cartonCount)
    {
        return $@"^XA
^CI28
^PW812
^LL1218
^LH0,0
^FO50,50^A0N,40,40^FDPALET ETİKETİ / PALLET LABEL^FS
^FO50,100^GB712,3,3^FS
^FO50,120^A0N,20,20^FDMusteri / Customer:^FS
^FO50,145^A0N,30,30^FD{order.CustomerName}^FS
^FO50,195^A0N,20,20^FDSiparis No: {order.OrderNo}^FS
^FO400,195^A0N,20,20^FDStok Kodu: {order.StockCode ?? "-"}^FS
^FO50,235^A0N,20,20^FDUrun Adi: {order.ProductName ?? "-"}^FS
^FO50,285^A0N,20,20^FDis Emri No: {order.GTIN}^FS
^FO400,285^A0N,20,20^FDKoli Sayisi: {cartonCount} / {order.CartonPerPallet}^FS
^FO50,335^A0N,20,20^FDPalet No: {pallet.PalletNo}^FS
^FO400,335^A0N,20,20^FDTarih: {pallet.CreatedAt.AddHours(3):dd.MM.yyyy HH:mm}^FS
        ^FO50,380^GB712,3,3^FS
        ^FO250,420^BQN,2,6^FDQA,{_frontendUrl}/?code={pallet.SSCC}^FS
        ^FO100,680^BY2^FO100,700^BCN,150,Y,N,N^FD(00){pallet.SSCC}^FS
        ^XZ";
    }

    public string GeneratePalletPplbLabel(PalletDto pallet, OrderDto order, int cartonCount)
    {
        var customerLines = WrapPplbText(order.CustomerName, 32, 2).ToArray();
        var productLines = WrapPplbText(order.ProductName ?? "-", 34, 2).ToArray();
        var ssccData = OnlyBarcodeSafeDigits(pallet.SSCC);
        var qrData = $"{_frontendUrl}/?code={pallet.SSCC}";

        var sb = new StringBuilder();
        AppendPplbHeader(sb, 812, 1218);
        AddPplbBox(sb, 25, 25, 2, 787, 1190);
        AddPplbLine(sb, 25, 105, 762, 2);
        AddPplbLine(sb, 25, 650, 762, 2);

        AddPplbText(sb, 260, 55, 4, "PALET ETIKETI / PALLET LABEL");
        AddPplbText(sb, 55, 135, 2, "Musteri / Customer:");
        AddPplbText(sb, 55, 165, 3, customerLines.ElementAtOrDefault(0) ?? "-");
        if (customerLines.Length > 1) AddPplbText(sb, 55, 195, 3, customerLines[1]);

        AddPplbText(sb, 55, 260, 2, $"Siparis No: {ToPplbText(order.OrderNo)}");
        AddPplbText(sb, 405, 260, 2, $"Stok Kodu: {ToPplbText(order.StockCode ?? "-")}");
        AddPplbText(sb, 55, 325, 2, "Urun Adi / Product:");
        AddPplbText(sb, 55, 355, 3, productLines.ElementAtOrDefault(0) ?? "-");
        if (productLines.Length > 1) AddPplbText(sb, 55, 385, 3, productLines[1]);

        AddPplbText(sb, 55, 460, 2, $"Is Emri No: {ToPplbText(order.GTIN)}");
        AddPplbText(sb, 405, 460, 2, $"Koli Sayisi: {cartonCount} / {order.CartonPerPallet}");
        AddPplbText(sb, 55, 530, 2, $"Palet No: {ToPplbText(pallet.PalletNo)}");
        AddPplbText(sb, 405, 530, 2, $"Tarih: {pallet.CreatedAt.AddHours(3):dd.MM.yyyy HH:mm}");

        AddPplbText(sb, 335, 700, 3, "SSCC BARCODE");
        AddPplbQr(sb, 315, 755, qrData, 6);
        AddPplbText(sb, 310, 1070, 3, $"(00){ssccData}");
        sb.AppendLine("P1");
        return sb.ToString();
    }

    private static void AppendPplbHeader(StringBuilder sb, int widthDots, int heightDots)
    {
        sb.AppendLine("N");
        sb.AppendLine($"q{widthDots}");
        sb.AppendLine($"Q{heightDots},24");
        sb.AppendLine("S3");
        sb.AppendLine("D8");
        sb.AppendLine("ZT");
    }

    private static void AddPplbText(StringBuilder sb, int x, int y, int font, string text)
    {
        sb.AppendLine($"A{x},{y},0,{font},1,1,N,\"{ToPplbText(text)}\"");
    }

    private static void AddPplbLine(StringBuilder sb, int x, int y, int width, int height)
    {
        sb.AppendLine($"LO{x},{y},{width},{height}");
    }

    private static void AddPplbBox(StringBuilder sb, int x, int y, int thickness, int endX, int endY)
    {
        sb.AppendLine($"X{x},{y},{thickness},{endX},{endY}");
    }

    private static void AddPplbQr(StringBuilder sb, int x, int y, string data, int scale)
    {
        sb.AppendLine($"b{x},{y},Q,m2,s{scale},eM,\"{ToPplbText(data)}\"");
    }

    private static string ToPplbText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "-";
        }

        var normalized = value
            .Replace('ı', 'i')
            .Replace('İ', 'I')
            .Replace('ğ', 'g')
            .Replace('Ğ', 'G')
            .Replace('ü', 'u')
            .Replace('Ü', 'U')
            .Replace('ş', 's')
            .Replace('Ş', 'S')
            .Replace('ö', 'o')
            .Replace('Ö', 'O')
            .Replace('ç', 'c')
            .Replace('Ç', 'C')
            .Normalize(NormalizationForm.FormD);

        var sb = new StringBuilder();
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (ch == '"')
            {
                sb.Append('\'');
            }
            else if (ch >= 32 && ch <= 126)
            {
                sb.Append(ch);
            }
        }

        var result = sb.ToString().Trim();
        return string.IsNullOrWhiteSpace(result) ? "-" : result;
    }

    private static string OnlyBarcodeSafeDigits(string? value)
    {
        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(digits) ? "0" : digits;
    }

    private static System.Collections.Generic.IEnumerable<string> WrapPplbText(string? text, int maxLength, int maxLines)
    {
        var words = ToPplbText(text).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var lines = new System.Collections.Generic.List<string>();
        var current = string.Empty;

        foreach (var word in words)
        {
            var candidate = string.IsNullOrEmpty(current) ? word : $"{current} {word}";
            if (candidate.Length <= maxLength)
            {
                current = candidate;
                continue;
            }

            if (!string.IsNullOrEmpty(current))
            {
                lines.Add(current);
            }

            current = word.Length <= maxLength ? word : word[..maxLength];
            if (lines.Count >= maxLines)
            {
                break;
            }
        }

        if (lines.Count < maxLines && !string.IsNullOrEmpty(current))
        {
            lines.Add(current);
        }

        return lines.Take(maxLines);
    }

    private static System.Collections.Generic.IEnumerable<string> SplitFixed(string text, int chunkSize)
    {
        var normalized = ToPplbText(text);
        for (var i = 0; i < normalized.Length; i += chunkSize)
        {
            yield return normalized.Substring(i, Math.Min(chunkSize, normalized.Length - i));
        }
    }

    private static string GetCartonSequence(string? cartonNo)
    {
        var normalized = ToPplbText(cartonNo);
        var lastPart = normalized.Split('-', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
        if (int.TryParse(lastPart, out var number))
        {
            return number.ToString(CultureInfo.InvariantCulture);
        }

        return "-";
    }

    private byte[] GenerateQRCodeBytes(string text)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(text, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrCodeData);
        return qrCode.GetGraphic(20);
    }

    public byte[] GenerateDataMatrixCodesPdf(System.Collections.Generic.IEnumerable<string> codes, int cols, int rows, int size, bool addText, string? line1, string? line2, bool labelBelow, int startIndex = 1, int totalCodes = -1, int fontSize = 10)
    {
        var codesList = codes.ToList();
        cols = Math.Max(1, cols);
        rows = Math.Max(1, rows);

        int currentCodesCount = codesList.Count;
        int displayTotalCodes = totalCodes > 0 ? totalCodes : currentCodesCount;
        int itemsPerPage = cols * rows;
        int totalPages = (int)Math.Ceiling(currentCodesCount / (double)itemsPerPage);
        const float pageSize = 595f;
        const float pageMargin = 20f;
        const float footerHeight = 18f;
        const float gridSpacing = 6f;
        float labelLineHeight = fontSize + 2f;
        float contentSize = pageSize - (pageMargin * 2);
        float gridHeight = contentSize - footerHeight;
        float cellWidth = (contentSize - (gridSpacing * (cols - 1))) / cols;
        float cellHeight = (gridHeight - (gridSpacing * (rows - 1))) / rows;
        float labelHeight = addText
            ? ((!string.IsNullOrWhiteSpace(line1) ? labelLineHeight : 0f) + (!string.IsNullOrWhiteSpace(line2) ? labelLineHeight : 0f) + 12f)
            : 0f;
        float barcodeSize = Math.Max(20f, Math.Min(cellWidth, cellHeight - labelHeight) - 4f);

        using var stream = new MemoryStream();

        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(pageSize, pageSize, Unit.Point);
                page.Margin(pageMargin, Unit.Point);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(9));

                page.Content().Column(mainCol =>
                {
                    for (int pageIdx = 0; pageIdx < totalPages; pageIdx++)
                    {
                        if (pageIdx > 0)
                        {
                            mainCol.Item().PageBreak();
                        }

                        var pageCodes = codesList.Skip(pageIdx * itemsPerPage).Take(itemsPerPage).ToList();
                        int firstIdx = startIndex + pageIdx * itemsPerPage;
                        int lastIdx = Math.Min(startIndex + (pageIdx + 1) * itemsPerPage - 1, startIndex + currentCodesCount - 1);

                        mainCol.Item().Height(gridHeight).Grid(grid =>
                        {
                            grid.Columns(cols);
                            grid.Spacing(gridSpacing);

                            foreach (var code in pageCodes)
                            {
                                grid.Item().Height(cellHeight).AlignCenter().AlignMiddle().Column(c =>
                                {
                                    c.Spacing(3);

                                    // If label is above
                                    if (!labelBelow && addText)
                                    {
                                        if (!string.IsNullOrWhiteSpace(line1)) c.Item().AlignCenter().Text(line1).FontSize(fontSize).Bold();
                                        if (!string.IsNullOrWhiteSpace(line2)) c.Item().AlignCenter().Text(line2).FontSize(fontSize);
                                    }

                                    byte[] imgBytes = GenerateDataMatrixImageBytes(code, size);
                                    c.Item().AlignCenter().Width(barcodeSize).Height(barcodeSize).Image(imgBytes);

                                    // If label is below
                                    if (labelBelow && addText)
                                    {
                                        if (!string.IsNullOrWhiteSpace(line1)) c.Item().AlignCenter().Text(line1).FontSize(fontSize).Bold();
                                        if (!string.IsNullOrWhiteSpace(line2)) c.Item().AlignCenter().Text(line2).FontSize(fontSize);
                                    }
                                });
                            }
                        });

                        string footerText = (firstIdx == lastIdx)
                            ? $"{firstIdx} / {displayTotalCodes}"
                            : $"{firstIdx}-{lastIdx} / {displayTotalCodes}";
                        mainCol.Item().Height(footerHeight).AlignCenter().AlignMiddle().Text(footerText).FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                    }
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public byte[] GenerateDataMatrixZip(System.Collections.Generic.IEnumerable<string> codes, int startIndex = 1)
    {
        using var ms = new MemoryStream();
        using (var archive = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Create, true))
        {
            int index = startIndex;
            foreach (var code in codes)
            {
                 byte[] imgBytes = GenerateDataMatrixImageBytes(code, 400);
                var entry = archive.CreateEntry($"dm_{index:D6}.png");
                using var entryStream = entry.Open();
                entryStream.Write(imgBytes, 0, imgBytes.Length);
                index++;
            }
        }
        return ms.ToArray();
    }

    public byte[] GenerateDataMatrixImage(string text)
    {
        return GenerateDataMatrixImageBytes(text, 400);
    }

    private byte[] GenerateDataMatrixImageBytes(string text, int size)
    {
        try
        {
            var options = new DatamatrixEncodingOptions
            {
                Width = size,
                Height = size,
                Margin = 2,
                PureBarcode = true,
                SymbolShape = ZXing.Datamatrix.Encoder.SymbolShapeHint.FORCE_NONE
            };

            string content = text;
            bool isGs1 = content.Length > 0 && content[0] == Gs1AutoHelper.GS;
            if (isGs1)
            {
                content = content.Substring(1);
                options.Hints[EncodeHintType.GS1_FORMAT] = true;
                
                if (content.Contains(Gs1AutoHelper.GS + "91") || content.Contains(Gs1AutoHelper.GS + "92"))
                {
                    options.Hints[EncodeHintType.DATA_MATRIX_COMPACT] = false;
                }
                else
                {
                    options.Hints[EncodeHintType.DATA_MATRIX_COMPACT] = true;
                }
            }

            options.Hints[EncodeHintType.CHARACTER_SET] = "ISO-8859-1";
            options.Hints[EncodeHintType.DISABLE_ECI] = true;

            var writer = new ZXing.SkiaSharp.BarcodeWriter
            {
                Format = BarcodeFormat.DATA_MATRIX,
                Options = options
            };

            using var bitmap = writer.Write(content);
            if (bitmap == null) return Array.Empty<byte>();

            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }
        catch
        {
            return Array.Empty<byte>();
        }
    }
}
