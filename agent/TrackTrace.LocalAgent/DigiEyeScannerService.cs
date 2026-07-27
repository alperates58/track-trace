using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Net.Http.Headers;
using System.Threading.Channels;
using ZXingCpp;

namespace TrackTrace.LocalAgent;

public sealed class DigiEyeScannerService : BackgroundService
{
    private const int MaximumFrameBytes = 16 * 1024 * 1024;
    private readonly Channel<DigiEyeFrame> _frames = Channel.CreateBounded<DigiEyeFrame>(new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.Wait,
        SingleReader = false,
        SingleWriter = true
    });
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AgentConfigStore _configStore;
    private readonly DigiEyeEventStore _eventStore;
    private readonly DigiEyeRuntimeState _runtimeState;
    private readonly DigiEyeFrameCache _frameCache;
    private readonly ILogger<DigiEyeScannerService> _logger;
    private readonly Dictionary<string, int> _activeCodes = new(StringComparer.Ordinal);
    private DateTimeOffset? _lastDecodedFrameAtUtc;

    public DigiEyeScannerService(
        IHttpClientFactory httpClientFactory,
        AgentConfigStore configStore,
        DigiEyeEventStore eventStore,
        DigiEyeRuntimeState runtimeState,
        DigiEyeFrameCache frameCache,
        ILogger<DigiEyeScannerService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configStore = configStore;
        _eventStore = eventStore;
        _runtimeState = runtimeState;
        _frameCache = frameCache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var captureTask = CaptureLoop(stoppingToken);
        var decodeTask = DecodeLoop(stoppingToken);
        await Task.WhenAll(captureTask, decodeTask);
    }

    private async Task CaptureLoop(CancellationToken stoppingToken)
    {
        var httpClient = _httpClientFactory.CreateClient("DigiEyeCamera");

        while (!stoppingToken.IsCancellationRequested)
        {
            var config = _configStore.Snapshot().DigiEye;
            if (!config.Enabled)
            {
                await Task.Delay(300, stoppingToken);
                continue;
            }

            var iteration = Stopwatch.StartNew();
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(config.RequestTimeoutMs);
                using var request = new HttpRequestMessage(HttpMethod.Get, AddCacheBuster(config.CameraUrl));
                request.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true, NoStore = true };

                using var response = await httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    timeout.Token);
                response.EnsureSuccessStatusCode();

                if (response.Content.Headers.ContentLength is > MaximumFrameBytes)
                    throw new InvalidDataException("Kamera karesi 16 MB sınırını aşıyor.");

                var bytes = await response.Content.ReadAsByteArrayAsync(timeout.Token);
                if (bytes.Length == 0 || bytes.Length > MaximumFrameBytes)
                    throw new InvalidDataException("Kamera boş veya çok büyük bir kare döndürdü.");

                var capturedAtUtc = DateTimeOffset.UtcNow;
                var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                var frame = new DigiEyeFrame(bytes, contentType, capturedAtUtc);
                _frameCache.Set(frame);
                _runtimeState.FrameCaptured(capturedAtUtc);

                if (!_frames.Writer.TryWrite(frame))
                {
                    if (_frames.Reader.TryRead(out _))
                        _runtimeState.FrameDropped();
                    _frames.Writer.TryWrite(frame);
                }
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                _runtimeState.Error("DigiEye kamera isteği zaman aşımına uğradı.");
            }
            catch (Exception ex)
            {
                _runtimeState.Error(ex.Message);
            }

            var remainingDelay = config.PollIntervalMs - (int)iteration.ElapsedMilliseconds;
            if (remainingDelay > 0)
                await Task.Delay(remainingDelay, stoppingToken);
        }
    }

    private async Task DecodeLoop(CancellationToken stoppingToken)
    {
        using var reader = new BarcodeReader
        {
            Formats = new BarcodeFormats(BarcodeFormat.QRCode, BarcodeFormat.DataMatrix, BarcodeFormat.Code128),
            TryHarder = true,
            TryRotate = true,
            TryInvert = true,
            TryDownscale = true,
            ReturnErrors = false,
            TextMode = TextMode.Plain,
            MaxNumberOfSymbols = 4
        };

        await foreach (var frame in _frames.Reader.ReadAllAsync(stoppingToken))
        {
            var config = _configStore.Snapshot().DigiEye;
            if (!config.Enabled)
                continue;

            var resetThreshold = TimeSpan.FromMilliseconds(Math.Max(1000, config.PollIntervalMs * 5));
            if (_lastDecodedFrameAtUtc.HasValue && frame.CapturedAtUtc - _lastDecodedFrameAtUtc.Value > resetThreshold)
                _activeCodes.Clear();
            _lastDecodedFrameAtUtc = frame.CapturedAtUtc;

            var stopwatch = Stopwatch.StartNew();
            try
            {
                var detected = DecodeFrame(frame.Bytes, config, reader);
                stopwatch.Stop();
                _runtimeState.FrameDecoded((int)stopwatch.ElapsedMilliseconds);
                ProcessDetectedCodes(detected, frame.CapturedAtUtc, (int)stopwatch.ElapsedMilliseconds, config);
                _runtimeState.ClearError();
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _runtimeState.FrameDecoded((int)stopwatch.ElapsedMilliseconds);
                _runtimeState.Error($"Görüntü çözümlenemedi: {ex.Message}");
                _logger.LogDebug(ex, "DigiEye frame decode failed.");
            }
        }
    }

    private static IReadOnlyList<(string Code, string Format)> DecodeFrame(
        byte[] bytes,
        DigiEyeConfig config,
        BarcodeReader reader)
    {
        using var stream = new MemoryStream(bytes, writable: false);
        using var source = new Bitmap(stream);
        var roi = CalculateRoi(source.Width, source.Height, config);
        using var bitmap = source.Clone(roi, PixelFormat.Format24bppRgb);
        var bitmapData = bitmap.LockBits(
            new Rectangle(0, 0, bitmap.Width, bitmap.Height),
            ImageLockMode.ReadOnly,
            PixelFormat.Format24bppRgb);

        try
        {
            var imageView = new ImageView(
                bitmapData.Scan0,
                bitmap.Width,
                bitmap.Height,
                ZXingCpp.ImageFormat.BGR,
                bitmapData.Stride,
                3);
            var barcodes = reader.From(imageView);
            try
            {
                return barcodes
                    .Where(barcode => barcode.IsValid && !string.IsNullOrWhiteSpace(barcode.Text))
                    .Select(barcode => (CleanCode(barcode.Text), barcode.Format.ToString()))
                    .Where(item => item.Item1.Length >= 3)
                    .Distinct()
                    .ToArray();
            }
            finally
            {
                foreach (var barcode in barcodes)
                    barcode.Dispose();
            }
        }
        finally
        {
            bitmap.UnlockBits(bitmapData);
        }
    }

    private void ProcessDetectedCodes(
        IReadOnlyList<(string Code, string Format)> detected,
        DateTimeOffset capturedAtUtc,
        int decodeMilliseconds,
        DigiEyeConfig config)
    {
        var visibleCodes = detected.Select(item => item.Code).ToHashSet(StringComparer.Ordinal);

        foreach (var item in detected)
        {
            if (_activeCodes.ContainsKey(item.Code))
            {
                _activeCodes[item.Code] = 0;
                continue;
            }

            if (!config.ShadowMode)
                _eventStore.Add(item.Code, item.Format, capturedAtUtc, decodeMilliseconds, "camera");

            _runtimeState.CodeDetected(item.Code, capturedAtUtc);
            _activeCodes[item.Code] = 0;
        }

        foreach (var activeCode in _activeCodes.Keys.ToArray())
        {
            if (visibleCodes.Contains(activeCode))
                continue;

            var missedFrames = _activeCodes[activeCode] + 1;
            if (missedFrames >= config.ReleaseAfterMissedFrames)
                _activeCodes.Remove(activeCode);
            else
                _activeCodes[activeCode] = missedFrames;
        }
    }

    private static Rectangle CalculateRoi(int width, int height, DigiEyeConfig config)
    {
        var x = Math.Clamp(width * config.RoiXPercent / 100, 0, width - 1);
        var y = Math.Clamp(height * config.RoiYPercent / 100, 0, height - 1);
        var roiWidth = Math.Clamp(width * config.RoiWidthPercent / 100, 1, width - x);
        var roiHeight = Math.Clamp(height * config.RoiHeightPercent / 100, 1, height - y);
        return new Rectangle(x, y, roiWidth, roiHeight);
    }

    private static string AddCacheBuster(string cameraUrl)
    {
        var separator = cameraUrl.Contains('?') ? '&' : '?';
        return $"{cameraUrl}{separator}tt={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
    }

    private static string CleanCode(string value) => value.Trim('\0', '\r', '\n', ' ', '\t');
}
