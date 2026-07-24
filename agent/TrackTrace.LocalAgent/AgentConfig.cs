namespace TrackTrace.LocalAgent;

public sealed class AgentConfig
{
    public string PairingToken { get; set; } = string.Empty;
    public string DefaultPrinter { get; set; } = "ARGOX CP-2140";
    public bool EnableDummyMode { get; set; }
    public DigiEyeConfig DigiEye { get; set; } = new();
}

public sealed class DigiEyeConfig
{
    public bool Enabled { get; set; }
    public string CameraUrl { get; set; } = "http://127.0.0.1:5173/latest-image";
    public int PollIntervalMs { get; set; } = 80;
    public int RequestTimeoutMs { get; set; } = 1000;
    public int ReleaseAfterMissedFrames { get; set; } = 3;
    public bool ShadowMode { get; set; }
    public int RoiXPercent { get; set; }
    public int RoiYPercent { get; set; }
    public int RoiWidthPercent { get; set; } = 100;
    public int RoiHeightPercent { get; set; } = 100;
}

public sealed record DigiEyeConfigRequest(
    bool Enabled,
    string CameraUrl,
    int PollIntervalMs,
    int RequestTimeoutMs,
    int ReleaseAfterMissedFrames,
    bool ShadowMode,
    int RoiXPercent,
    int RoiYPercent,
    int RoiWidthPercent,
    int RoiHeightPercent);

public sealed record PrintRequest(string Data);
