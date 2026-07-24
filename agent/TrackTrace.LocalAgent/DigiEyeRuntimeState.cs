using System.Diagnostics;

namespace TrackTrace.LocalAgent;

public sealed class DigiEyeRuntimeState
{
    private readonly object _gate = new();
    private readonly Stopwatch _rateWindow = Stopwatch.StartNew();
    private DateTimeOffset? _lastFrameAtUtc;
    private DateTimeOffset? _lastDetectionAtUtc;
    private string? _lastDecodedCode;
    private string? _lastError;
    private double _captureFramesPerSecond;
    private long _rateWindowFrames;
    private int _lastDecodeMilliseconds;
    private long _capturedFrames;
    private long _decodedFrames;
    private long _droppedFrames;
    private long _detectedCodes;

    public void FrameCaptured(DateTimeOffset capturedAtUtc)
    {
        lock (_gate)
        {
            _lastFrameAtUtc = capturedAtUtc;
            _capturedFrames++;
            _rateWindowFrames++;
            if (_rateWindow.ElapsedMilliseconds >= 1000)
            {
                _captureFramesPerSecond = _rateWindowFrames * 1000d / _rateWindow.ElapsedMilliseconds;
                _rateWindowFrames = 0;
                _rateWindow.Restart();
            }
        }
    }

    public void FrameDecoded(int milliseconds)
    {
        lock (_gate)
        {
            _decodedFrames++;
            _lastDecodeMilliseconds = milliseconds;
        }
    }

    public void FrameDropped()
    {
        lock (_gate)
            _droppedFrames++;
    }

    public void CodeDetected(string code, DateTimeOffset capturedAtUtc)
    {
        lock (_gate)
        {
            _lastDetectionAtUtc = capturedAtUtc;
            _lastDecodedCode = code;
            _detectedCodes++;
        }
    }

    public void Error(string message)
    {
        lock (_gate)
            _lastError = message;
    }

    public void ClearError()
    {
        lock (_gate)
            _lastError = null;
    }

    public DigiEyeStatus Snapshot(DigiEyeConfig config, int pendingEvents)
    {
        lock (_gate)
        {
            var connectedThreshold = TimeSpan.FromMilliseconds(Math.Max(3000, config.RequestTimeoutMs * 3));
            var cameraConnected = config.Enabled
                && _lastFrameAtUtc.HasValue
                && DateTimeOffset.UtcNow - _lastFrameAtUtc.Value <= connectedThreshold;

            return new DigiEyeStatus(
                config.Enabled,
                cameraConnected,
                config.ShadowMode,
                config.CameraUrl,
                _lastFrameAtUtc,
                _lastDetectionAtUtc,
                _lastDecodedCode,
                _lastError,
                Math.Round(_captureFramesPerSecond, 1),
                _lastDecodeMilliseconds,
                _capturedFrames,
                _decodedFrames,
                _droppedFrames,
                _detectedCodes,
                pendingEvents);
        }
    }
}
