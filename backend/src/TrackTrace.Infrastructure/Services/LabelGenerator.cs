using System;
using System.IO;
using System.Linq;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using Barcoder.DataMatrix;
using Barcoder.Renderer.Image;
using BarcoderImageFormat = Barcoder.Renderer.Image.ImageFormat;

namespace TrackTrace.Infrastructure.Services;

public class LabelGenerator : ILabelGenerator
{
    public byte[] GenerateCartonPdfLabel(CartonDto carton, OrderDto order)
    {
        // Generate QR code bytes using QRCoder (does not require System.Drawing, fully Linux-safe!)
        byte[] qrCodeImageBytes = GenerateQRCodeBytes($"[00]{carton.SSCC}|[01]{order.GTIN}|[30]{carton.ActualQuantity}");

        using var stream = new MemoryStream();
        
        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(4, 6, Unit.Inch); // Standard 4x6 inch label size
                page.Margin(0.2f, Unit.Inch);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(10));

                page.Content().Border(1).BorderColor(Colors.Black).Padding(10).Column(col =>
                {
                    col.Spacing(8);

                    col.Item().AlignCenter().Text("KOLİ ETİKETİ / CARTON LABEL").Bold().FontSize(14);
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
                            c.Item().Text("Adet / Quantity:").Bold().FontSize(8);
                            c.Item().Text($"{carton.ActualQuantity} / {carton.TargetQuantity}").FontSize(12).Bold();
                        });
                    });

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Koli No / Carton No:").Bold().FontSize(8);
                            c.Item().Text(carton.CartonNo);
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("Tarih / Date:").Bold().FontSize(8);
                            c.Item().Text(carton.CreatedAt.ToString("dd.MM.yyyy HH:mm"));
                        });
                    });

                    col.Item().LineHorizontal(1);

                    col.Item().AlignCenter().Column(c =>
                    {
                        c.Spacing(4);
                        c.Item().AlignCenter().Text("SSCC BARCODE").Bold().FontSize(8);
                        c.Item().AlignCenter().Width(120).Height(120).Image(qrCodeImageBytes);
                        c.Item().AlignCenter().Text($"(00){carton.SSCC}").Bold().FontSize(11);
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
^PW812
^LL1218
^LH0,0
^FO50,50^A0N,40,40^FDKOLI ETİKETİ / CARTON LABEL^FS
^FO50,100^GB712,3,3^FS
^FO50,120^A0N,20,20^FDMusteri / Customer:^FS
^FO50,145^A0N,30,30^FD{order.CustomerName}^FS
^FO50,195^A0N,20,20^FDSiparis No: {order.OrderNo}^FS
^FO400,195^A0N,20,20^FDStok Kodu: {order.StockCode ?? "-"}^FS
^FO50,235^A0N,20,20^FDUrun Adi: {order.ProductName ?? "-"}^FS
^FO50,285^A0N,20,20^FDis Emri No: {order.GTIN}^FS
^FO400,285^A0N,20,20^FDAdet: {carton.ActualQuantity} / {carton.TargetQuantity}^FS
^FO50,335^A0N,20,20^FDKoli No: {carton.CartonNo}^FS
^FO400,335^A0N,20,20^FDTarih: {carton.CreatedAt:dd.MM.yyyy HH:mm}^FS
^FO50,380^GB712,3,3^FS
^FO250,420^BQN,2,8^FDQA,(00){carton.SSCC}^FS
^FO150,680^BY3^FO150,700^BCN,150,Y,N,N^FD(00){carton.SSCC}^FS
^XZ";
    }

    public byte[] GeneratePalletPdfLabel(PalletDto pallet, OrderDto order, int cartonCount)
    {
        byte[] qrCodeImageBytes = GenerateQRCodeBytes($"[00]{pallet.SSCC}|[01]{order.GTIN}|[37]{cartonCount}");

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
^FO250,420^BQN,2,8^FDQA,(00){pallet.SSCC}^FS
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
        int totalCodes = codesList.Count;
        int itemsPerPage = cols * rows;
        if (itemsPerPage <= 0) itemsPerPage = 1;
        int totalPages = (int)Math.Ceiling(totalCodes / (double)itemsPerPage);

        using var stream = new MemoryStream();

        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(595, 595, Unit.Point);
                page.Margin(0.4f, Unit.Inch);
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

                        mainCol.Item().Height(530).Column(pageCol =>
                        {
                            pageCol.Item().Grid(grid =>
                            {
                                grid.Columns(cols);
                                grid.Spacing(15);

                                foreach (var code in pageCodes)
                                {
                                    grid.Item().AlignCenter().Column(c =>
                                    {
                                        c.Spacing(3);

                                        // If label is above
                                        if (!labelBelow && addText)
                                        {
                                            if (!string.IsNullOrWhiteSpace(line1)) c.Item().AlignCenter().Text(line1).FontSize(8).Bold();
                                            if (!string.IsNullOrWhiteSpace(line2)) c.Item().AlignCenter().Text(line2).FontSize(8);
                                        }

                                        // Draw DataMatrix barcode image
                                        byte[] imgBytes = GenerateDataMatrixImageBytes(code);
                                        c.Item().AlignCenter().Width(size).Height(size).Image(imgBytes);

                                        // If label is below
                                        if (labelBelow && addText)
                                        {
                                            if (!string.IsNullOrWhiteSpace(line1)) c.Item().AlignCenter().Text(line1).FontSize(8).Bold();
                                            if (!string.IsNullOrWhiteSpace(line2)) c.Item().AlignCenter().Text(line2).FontSize(8);
                                        }
                                    });
                                }
                            });

                            // Page range footer
                            string footerText = (firstIdx == lastIdx)
                                ? $"{firstIdx} / {totalCodes}"
                                : $"{firstIdx}-{lastIdx} / {totalCodes}";
                            pageCol.Item().AlignBottom().AlignCenter().Text(footerText).FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                        });
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
                byte[] imgBytes = GenerateDataMatrixImageBytes(code);
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
        return GenerateDataMatrixImageBytes(text);
    }

    private byte[] GenerateDataMatrixImageBytes(string text)
    {
        try
        {
            var barcode = DataMatrixEncoder.Encode(text);
            var renderer = new ImageRenderer(new ImageRendererOptions { ImageFormat = BarcoderImageFormat.Png });
            using var ms = new MemoryStream();
            renderer.Render(barcode, ms);
            return ms.ToArray();
        }
        catch
        {
            return Array.Empty<byte>();
        }
    }
}
