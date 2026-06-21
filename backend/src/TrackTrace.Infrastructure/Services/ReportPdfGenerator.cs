using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Infrastructure.Services;

public class ReportPdfGenerator : IReportPdfGenerator
{
    public byte[] GenerateOrderReportPdf(
        string orderNo,
        object summaryObj,
        IEnumerable<object> stockCodesObj,
        IEnumerable<object> cartonsObj,
        IEnumerable<object> palletsObj,
        IEnumerable<object> missingSummaryObj)
    {
        dynamic summary = summaryObj;
        var stockCodes = stockCodesObj.Select(x => (dynamic)x).ToList();
        var cartons = cartonsObj.Select(x => (dynamic)x).ToList();
        var pallets = palletsObj.Select(x => (dynamic)x).ToList();
        var missingSummary = missingSummaryObj.Select(x => (dynamic)x).ToList();

        // Cast summary counts to static types
        int expectedQty = Convert.ToInt32(summary.ExpectedQuantity);
        int usedQty = Convert.ToInt32(summary.UsedQuantity);
        int missingQty = Convert.ToInt32(summary.MissingQuantity);
        int totalCartons = Convert.ToInt32(summary.TotalCartons);
        int totalPallets = Convert.ToInt32(summary.TotalPallets);
        int totalStockCodes = Convert.ToInt32(summary.TotalStockCodes);
        string customerName = (string)(summary.CustomerName ?? "-");
        DateTime? lastProcessedAt = (DateTime?)summary.LastProcessedAt;

        using var stream = new MemoryStream();

        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").Size(9));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(titleCol =>
                        {
                            titleCol.Item().Text("TRACK & TRACE RAPORLAMA SİSTEMİ").Bold().FontSize(14).FontColor(Colors.Blue.Darken3);
                            titleCol.Item().Text($"Sipariş Raporu: {orderNo}").Bold().FontSize(12).FontColor(Colors.Grey.Darken2);
                        });
                        row.ConstantItem(120).AlignRight().Text(DateTime.Now.ToString("dd.MM.yyyy HH:mm")).FontSize(8).FontColor(Colors.Grey.Darken1);
                    });
                    col.Item().PaddingTop(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                });

                page.Content().Column(col =>
                {
                    col.Spacing(12);

                    // 1. Summary Info / KPI Cards
                    col.Item().PaddingTop(10).Row(row =>
                    {
                        row.Spacing(10);
                        
                        // Expected QR Card
                        row.RelativeItem().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Background(Colors.Grey.Lighten4).Padding(8).Column(c =>
                        {
                            c.Item().Text("Beklenen QR").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(expectedQty.ToString()).Bold().FontSize(14).FontColor(Colors.Blue.Darken2);
                        });

                        // Used QR Card
                        row.RelativeItem().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Background(Colors.Grey.Lighten4).Padding(8).Column(c =>
                        {
                            c.Item().Text("Okutulan QR").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(usedQty.ToString()).Bold().FontSize(14).FontColor(Colors.Green.Darken2);
                        });

                        // Missing QR Card
                        row.RelativeItem().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Background(Colors.Grey.Lighten4).Padding(8).Column(c =>
                        {
                            c.Item().Text("Eksik QR").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(missingQty.ToString()).Bold().FontSize(14).FontColor(Colors.Red.Darken2);
                        });

                        // Total Cartons Card
                        row.RelativeItem().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Background(Colors.Grey.Lighten4).Padding(8).Column(c =>
                        {
                            c.Item().Text("Toplam Koli").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(totalCartons.ToString()).Bold().FontSize(14);
                        });

                        // Total Pallets Card
                        row.RelativeItem().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Background(Colors.Grey.Lighten4).Padding(8).Column(c =>
                        {
                            c.Item().Text("Toplam Palet").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text(totalPallets.ToString()).Bold().FontSize(14);
                        });

                        // Completion Rate Card
                        row.RelativeItem().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Background(Colors.Grey.Lighten4).Padding(8).Column(c =>
                        {
                            c.Item().Text("Tamamlanma").FontSize(8).FontColor(Colors.Grey.Darken1);
                            double rate = expectedQty > 0 ? (double)usedQty / expectedQty * 100 : 0;
                            c.Item().Text($"{rate:F1}%").Bold().FontSize(14).FontColor(rate >= 100 ? Colors.Green.Darken2 : Colors.Orange.Darken2);
                        });
                    });

                    // 2. Order Metadata Info Table
                    col.Item().Background(Colors.Grey.Lighten5).Padding(8).Row(row =>
                    {
                        row.RelativeItem().Text($"Müşteri / Cari: {customerName}").Bold();
                        row.RelativeItem().Text($"Toplam Stok Kodu: {totalStockCodes}").Bold();
                        row.RelativeItem().Text($"Son İşlem Tarihi: {(lastProcessedAt.HasValue ? lastProcessedAt.Value.ToString("dd.MM.yyyy HH:mm") : "-")}");
                    });

                    // 3. Stock Code Completion Table
                    col.Item().Column(scCol =>
                    {
                        scCol.Spacing(4);
                        scCol.Item().Text("Stok Kodu Bazlı Tamamlanma Durumu").Bold().FontSize(10).FontColor(Colors.Blue.Darken3);
                        scCol.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(2); // Stock Code
                                columns.RelativeColumn(3); // Product Name
                                columns.RelativeColumn(1); // Expected
                                columns.RelativeColumn(1); // Used
                                columns.RelativeColumn(1); // Missing
                                columns.RelativeColumn(1); // Carton
                                columns.RelativeColumn(1); // Pallet
                                columns.RelativeColumn(1.2f); // Completion %
                            });

                            // Header
                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Stok Kodu").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Ürün Adı").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Beklenen").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Kullanılan").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Eksik").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Koli").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Palet").Bold().FontColor(Colors.White).FontSize(8);
                                header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Tamamlanma").Bold().FontColor(Colors.White).FontSize(8);
                            });

                            foreach (var sc in stockCodes)
                            {
                                string scStockCode = (string)(sc.StockCode ?? "-");
                                string scProductName = (string)(sc.ProductName ?? "-");
                                int scExpected = Convert.ToInt32(sc.ExpectedQuantity);
                                int scUsed = Convert.ToInt32(sc.UsedQuantity);
                                int scMissing = Convert.ToInt32(sc.MissingQuantity);
                                int scCarton = Convert.ToInt32(sc.CartonCount);
                                int scPallet = Convert.ToInt32(sc.PalletCount);
                                double compRate = scExpected > 0 ? (double)scUsed / scExpected * 100 : 0;

                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(scStockCode).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(scProductName).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(scExpected.ToString()).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(scUsed.ToString()).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(scMissing.ToString()).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(scCarton.ToString()).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(scPallet.ToString()).FontSize(8);
                                table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text($"{compRate:F1}%").FontSize(8).Bold().FontColor(compRate >= 100 ? Colors.Green.Darken2 : Colors.Orange.Darken2);
                            }
                        });
                    });

                    // 4. Carton Summary (First 15 to keep report size short)
                    if (cartons.Any())
                    {
                        col.Item().Column(cCol =>
                        {
                            cCol.Spacing(4);
                            cCol.Item().Text($"Koli Bazlı Dağılım Özet (Toplam: {cartons.Count} koli)").Bold().FontSize(10).FontColor(Colors.Blue.Darken3);
                            cCol.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(2); // Carton No
                                    columns.RelativeColumn(3); // SSCC
                                    columns.RelativeColumn(1.5f); // Qty
                                    columns.RelativeColumn(1.5f); // Status
                                    columns.RelativeColumn(2); // Pallet No
                                    columns.RelativeColumn(2.5f); // Created At
                                });

                                table.Header(header =>
                                {
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Koli No").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("SSCC").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Adet").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Durum").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Palet No").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Oluşturulma Tarihi").Bold().FontColor(Colors.White).FontSize(8);
                                });

                                foreach (var c in cartons.Take(15))
                                {
                                    string cCartonNo = (string)(c.CartonNo ?? "-");
                                    string cSSCC = (string)(c.SSCC ?? "-");
                                    int cActual = Convert.ToInt32(c.ActualQuantity);
                                    int cTarget = Convert.ToInt32(c.TargetQuantity);
                                    string cStatus = (string)(c.Status ?? "-");
                                    string cPalletNo = (string)(c.PalletNo ?? "Paletlenmemiş");
                                    DateTime cCreatedAt = (DateTime)c.CreatedAt;

                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(cCartonNo).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(cSSCC).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text($"{cActual} / {cTarget}").FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(cStatus).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(cPalletNo).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(cCreatedAt.ToString("dd.MM.yyyy HH:mm")).FontSize(8);
                                }
                            });
                            
                            if (cartons.Count > 15)
                            {
                                cCol.Item().Text($"* Yalnızca ilk 15 koli listelenmiştir. Detaylı koli listesi için lütfen Excel raporunu kullanınız.").FontSize(8).Italic().FontColor(Colors.Grey.Darken1);
                            }
                        });
                    }

                    // 5. Pallet Summary
                    if (pallets.Any())
                    {
                        col.Item().Column(pCol =>
                        {
                            pCol.Spacing(4);
                            pCol.Item().Text($"Palet Bazlı Dağılım Özet (Toplam: {pallets.Count} palet)").Bold().FontSize(10).FontColor(Colors.Blue.Darken3);
                            pCol.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(2); // Pallet No
                                    columns.RelativeColumn(3); // SSCC
                                    columns.RelativeColumn(2); // Carton Count
                                    columns.RelativeColumn(2); // Status
                                    columns.RelativeColumn(3); // Created At
                                });

                                table.Header(header =>
                                {
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Palet No").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("SSCC").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Koli Sayısı").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Durum").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Oluşturulma Tarihi").Bold().FontColor(Colors.White).FontSize(8);
                                });

                                foreach (var p in pallets)
                                {
                                    string pPalletNo = (string)(p.PalletNo ?? "-");
                                    string pSSCC = (string)(p.SSCC ?? "-");
                                    int pCartonCount = Convert.ToInt32(p.CartonCount);
                                    string pStatus = (string)(p.Status ?? "-");
                                    DateTime pCreatedAt = (DateTime)p.CreatedAt;

                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(pPalletNo).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(pSSCC).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(pCartonCount.ToString()).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(pStatus).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(pCreatedAt.ToString("dd.MM.yyyy HH:mm")).FontSize(8);
                                }
                            });
                        });
                    }

                    // 6. Missing Summary (By stock code)
                    if (missingSummary.Any())
                    {
                        col.Item().Column(mCol =>
                        {
                            mCol.Spacing(4);
                            mCol.Item().Text("Eksik QR Kodu Sayıları (Yüklenen ama henüz okutulmayanlar)").Bold().FontSize(10).FontColor(Colors.Blue.Darken3);
                            mCol.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(3); // Stock Code
                                    columns.RelativeColumn(5); // Product Name
                                    columns.RelativeColumn(2); // Missing Count
                                });

                                table.Header(header =>
                                {
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Stok Kodu").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).Text("Ürün Adı").Bold().FontColor(Colors.White).FontSize(8);
                                    header.Cell().Background(Colors.Grey.Darken2).Padding(4).AlignRight().Text("Eksik QR Adeti").Bold().FontColor(Colors.White).FontSize(8);
                                });

                                foreach (var ms in missingSummary)
                                {
                                    string msStockCode = (string)(ms.StockCode ?? "-");
                                    string msProductName = (string)(ms.ProductName ?? "-");
                                    int msMissingCount = Convert.ToInt32(ms.MissingCount);

                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(msStockCode).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(msProductName).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).AlignRight().Text(msMissingCount.ToString()).FontSize(8).Bold().FontColor(Colors.Red.Darken2);
                                }
                            });
                        });
                    }
                });

                page.Footer().AlignCenter().Column(fCol =>
                {
                    fCol.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten1);
                    fCol.Item().PaddingTop(3).Text(x =>
                    {
                        x.Span("Sayfa ").FontSize(8);
                        x.CurrentPageNumber().FontSize(8);
                        x.Span(" / ").FontSize(8);
                        x.TotalPages().FontSize(8);
                    });
                });
            });
        }).GeneratePdf(stream);

        return stream.ToArray();
    }
}
