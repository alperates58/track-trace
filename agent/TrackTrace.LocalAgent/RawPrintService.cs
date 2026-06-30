using System;
using Microsoft.Extensions.Logging;

namespace TrackTrace.LocalAgent
{
    public class PrintResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
        public bool DummyMode { get; set; }
    }

    public interface IPrintService
    {
        PrintResult PrintRawZpl(string zplData, string printerName = null, bool enableDummyMode = false);
    }

    public class RawPrintService : IPrintService
    {
        private readonly ILogger<RawPrintService> _logger;

        public RawPrintService(ILogger<RawPrintService> logger)
        {
            _logger = logger;
        }

        public PrintResult PrintRawZpl(string zplData, string printerName = null, bool enableDummyMode = false)
        {
            var printer = string.IsNullOrWhiteSpace(printerName) ? "Default Printer" : printerName;
            
            try
            {
                _logger.LogInformation($"Printing ZPL to {printer}... Length: {zplData?.Length ?? 0}");

                if (enableDummyMode)
                {
                    _logger.LogInformation("[DUMMY MODE] ZPL DATA:\n" + zplData);
                    return new PrintResult { Success = true, DummyMode = true };
                }

                if (string.IsNullOrWhiteSpace(zplData))
                {
                    throw new ArgumentException("ZPL data cannot be empty");
                }

                RawPrinterHelper.SendStringToPrinter(printer, zplData);
                return new PrintResult { Success = true, DummyMode = false };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to print ZPL to '{printer}'");
                return new PrintResult 
                { 
                    Success = false, 
                    ErrorMessage = ex.Message,
                    DummyMode = false
                };
            }
        }
    }
}
