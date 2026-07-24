namespace TrackTrace.LocalAgent;

public sealed record DigiEyeEvent(
    long Sequence,
    string RawCode,
    string Format,
    DateTimeOffset CapturedAtUtc,
    int DecodeMilliseconds,
    string Source);

public sealed record DigiEyeFrame(byte[] Bytes, string ContentType, DateTimeOffset CapturedAtUtc);

public sealed record DigiEyeStatus(
    bool Enabled,
    bool CameraConnected,
    bool ShadowMode,
    string CameraUrl,
    DateTimeOffset? LastFrameAtUtc,
    DateTimeOffset? LastDetectionAtUtc,
    string? LastDecodedCode,
    string? LastError,
    double CaptureFramesPerSecond,
    int LastDecodeMilliseconds,
    long CapturedFrames,
    long DecodedFrames,
    long DroppedFrames,
    long DetectedCodes,
    int PendingEvents);

public sealed record DigiEyeAckRequest(long Sequence);
public sealed record DigiEyeSimulationRequest(string RawCode, string? Format);

internal sealed class DigiEyeQueueState
{
    public long NextSequence { get; set; } = 1;
    public long LastAcknowledgedSequence { get; set; }
    public List<DigiEyeEvent> Pending { get; set; } = [];
}

public enum DigiEyeAcknowledgeResult
{
    Acknowledged,
    AlreadyAcknowledged,
    OutOfOrder
}
