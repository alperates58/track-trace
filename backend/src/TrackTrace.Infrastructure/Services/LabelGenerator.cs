using System;
using System.IO;
using System.Linq;
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

    public byte[] GenerateCartonPdfLabel(CartonDto carton, OrderDto order)
    {
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

                page.Content().Border(1).BorderColor(Colors.Black).Padding(6).Column(col =>
                {
                    col.Spacing(4);

                    col.Item().AlignCenter().Text("KOLİ ETİKETİ / CARTON LABEL").Bold().FontSize(11);
                    col.Item().LineHorizontal(0.5f);

                    col.Item().Row(row =>
                    {
                        // Left Column: Details (60% width)
                        row.RelativeItem(3).Column(details =>
                        {
                            details.Spacing(4);

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
                                    c.Item().Text($"{carton.ActualQuantity} / {carton.TargetQuantity}").Bold().FontSize(9);
                                });
                            });

                            // Koli No & Tarih / Date
                            details.Item().Row(r =>
                            {
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Koli No / Carton No:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(carton.CartonNo).FontSize(8);
                                });
                                r.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Tarih / Date:").Bold().FontSize(7).FontColor(Colors.Grey.Darken3);
                                    c.Item().Text(carton.CreatedAt.ToString("dd.MM.yyyy HH:mm")).FontSize(8);
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
                        });
                    });
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public string GenerateCartonZplLabel(CartonDto carton, OrderDto order)
    {
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
^FO40,325^A0N,22,22^FDAdet / Quantity: {carton.ActualQuantity} / {carton.TargetQuantity}^FS
^FO40,360^A0N,18,18^FDKoli No / Carton No: {carton.CartonNo}^FS
^FO40,390^A0N,18,18^FDTarih / Date: {carton.CreatedAt:dd.MM.yyyy HH:mm}^FS
^FO490,110^GB3,310,3^FS
^FO500,110^A0N,20,20^FB280,1,0,C^FDSSCC BARCODE^FS
^FO525,150^BQN,2,7^FDQA,{_frontendUrl}/?code={carton.SSCC}^FS
^FO500,390^A0N,20,20^FB280,1,0,C^FD(00){carton.SSCC}^FS
^XZ";
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
                            c.Item().Text(pallet.CreatedAt.ToString("dd.MM.yyyy HH:mm"));
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
^FO400,335^A0N,20,20^FDTarih: {pallet.CreatedAt:dd.MM.yyyy HH:mm}^FS
        ^FO50,380^GB712,3,3^FS
        ^FO200,420^BQN,2,8^FDQA,{_frontendUrl}/?code={pallet.SSCC}^FS
        ^FO150,680^BY3^FO150,700^BCN,150,Y,N,N^FD(00){pallet.SSCC}^FS
        ^XZ";
    }

    private byte[] GenerateQRCodeBytes(string text)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(text, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrCodeData);
        return qrCode.GetGraphic(20);
    }

    public byte[] GenerateDataMatrixCodesPdf(System.Collections.Generic.IEnumerable<string> codes, int cols, int rows, int size, bool addText, string? line1, string? line2, bool labelBelow)
    {
        var codesList = codes.ToList();
        cols = Math.Max(1, cols);
        rows = Math.Max(1, rows);

        int totalCodes = codesList.Count;
        int itemsPerPage = cols * rows;
        int totalPages = (int)Math.Ceiling(totalCodes / (double)itemsPerPage);
        const float pageSize = 595f;
        const float pageMargin = 10f;
        const float footerHeight = 18f;
        const float gridSpacing = 6f;
        const float labelLineHeight = 10f;
        float contentSize = pageSize - (pageMargin * 2);
        float gridHeight = contentSize - footerHeight;
        float cellWidth = (contentSize - (gridSpacing * (cols - 1))) / cols;
        float cellHeight = (gridHeight - (gridSpacing * (rows - 1))) / rows;
        float labelHeight = addText
            ? ((!string.IsNullOrWhiteSpace(line1) ? labelLineHeight : 0f) + (!string.IsNullOrWhiteSpace(line2) ? labelLineHeight : 0f) + 4f)
            : 0f;
        float barcodeSize = Math.Max(20f, Math.Min(cellWidth, cellHeight - labelHeight));

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
                        int firstIdx = pageIdx * itemsPerPage + 1;
                        int lastIdx = Math.Min((pageIdx + 1) * itemsPerPage, totalCodes);

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
                                        if (!string.IsNullOrWhiteSpace(line1)) c.Item().AlignCenter().Text(line1).FontSize(8).Bold();
                                        if (!string.IsNullOrWhiteSpace(line2)) c.Item().AlignCenter().Text(line2).FontSize(8);
                                    }

                                    byte[] imgBytes = GenerateDataMatrixImageBytes(code, size);
                                    c.Item().AlignCenter().Width(barcodeSize).Height(barcodeSize).Image(imgBytes);

                                    // If label is below
                                    if (labelBelow && addText)
                                    {
                                        if (!string.IsNullOrWhiteSpace(line1)) c.Item().AlignCenter().Text(line1).FontSize(8).Bold();
                                        if (!string.IsNullOrWhiteSpace(line2)) c.Item().AlignCenter().Text(line2).FontSize(8);
                                    }
                                });
                            }
                        });

                        string footerText = (firstIdx == lastIdx)
                            ? $"{firstIdx} / {totalCodes}"
                            : $"{firstIdx}-{lastIdx} / {totalCodes}";
                        mainCol.Item().Height(footerHeight).AlignCenter().AlignMiddle().Text(footerText).FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                    }
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }

    public byte[] GenerateDataMatrixZip(System.Collections.Generic.IEnumerable<string> codes)
    {
        using var ms = new MemoryStream();
        using (var archive = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Create, true))
        {
            int index = 1;
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
                options.Hints[EncodeHintType.DATA_MATRIX_COMPACT] = true;
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
