using System.Text.Json;

namespace TrackTrace.LocalAgent;

public sealed class AgentConfigStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly object _gate = new();
    private readonly string _configPath;
    private AgentConfig _config;

    public AgentConfigStore(string dataDirectory)
    {
        Directory.CreateDirectory(dataDirectory);
        Directory.CreateDirectory(Path.Combine(dataDirectory, "Logs"));
        _configPath = Path.Combine(dataDirectory, "agent.config.json");
        _config = LoadOrCreate();
    }

    public string PairingToken
    {
        get
        {
            lock (_gate)
                return _config.PairingToken;
        }
    }

    public AgentConfig Snapshot()
    {
        lock (_gate)
            return Clone(_config);
    }

    public AgentConfig UpdateAgent(AgentConfig request)
    {
        lock (_gate)
        {
            if (!string.IsNullOrWhiteSpace(request.DefaultPrinter))
                _config.DefaultPrinter = request.DefaultPrinter.Trim();

            _config.EnableDummyMode = request.EnableDummyMode;
            SaveLocked();
            return Clone(_config);
        }
    }

    public DigiEyeConfig UpdateDigiEye(DigiEyeConfigRequest request)
    {
        var cameraUrl = request.CameraUrl.Trim();
        if (!Uri.TryCreate(cameraUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttp)
            throw new ArgumentException("Kamera adresi http:// ile başlayan geçerli bir adres olmalıdır.");

        var roiX = Math.Clamp(request.RoiXPercent, 0, 99);
        var roiY = Math.Clamp(request.RoiYPercent, 0, 99);
        var roiWidth = Math.Clamp(request.RoiWidthPercent, 1, 100 - roiX);
        var roiHeight = Math.Clamp(request.RoiHeightPercent, 1, 100 - roiY);

        lock (_gate)
        {
            _config.DigiEye = new DigiEyeConfig
            {
                Enabled = request.Enabled,
                CameraUrl = cameraUrl,
                PollIntervalMs = Math.Clamp(request.PollIntervalMs, 40, 1000),
                RequestTimeoutMs = Math.Clamp(request.RequestTimeoutMs, 250, 5000),
                ReleaseAfterMissedFrames = Math.Clamp(request.ReleaseAfterMissedFrames, 1, 20),
                ShadowMode = request.ShadowMode,
                RoiXPercent = roiX,
                RoiYPercent = roiY,
                RoiWidthPercent = roiWidth,
                RoiHeightPercent = roiHeight
            };
            SaveLocked();
            return Clone(_config).DigiEye;
        }
    }

    private AgentConfig LoadOrCreate()
    {
        AgentConfig config;
        if (File.Exists(_configPath))
        {
            config = JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(_configPath))
                ?? throw new InvalidDataException($"Invalid agent configuration: {_configPath}");
        }
        else
        {
            config = new AgentConfig();
        }

        if (string.IsNullOrWhiteSpace(config.PairingToken))
            config.PairingToken = Guid.NewGuid().ToString();

        config.DigiEye ??= new DigiEyeConfig();
        _config = config;
        SaveLocked();
        return config;
    }

    private void SaveLocked()
    {
        var temporaryPath = _configPath + ".tmp";
        File.WriteAllText(temporaryPath, JsonSerializer.Serialize(_config, JsonOptions));
        File.Move(temporaryPath, _configPath, true);
    }

    private static AgentConfig Clone(AgentConfig config) => new()
    {
        PairingToken = config.PairingToken,
        DefaultPrinter = config.DefaultPrinter,
        EnableDummyMode = config.EnableDummyMode,
        DigiEye = new DigiEyeConfig
        {
            Enabled = config.DigiEye.Enabled,
            CameraUrl = config.DigiEye.CameraUrl,
            PollIntervalMs = config.DigiEye.PollIntervalMs,
            RequestTimeoutMs = config.DigiEye.RequestTimeoutMs,
            ReleaseAfterMissedFrames = config.DigiEye.ReleaseAfterMissedFrames,
            ShadowMode = config.DigiEye.ShadowMode,
            RoiXPercent = config.DigiEye.RoiXPercent,
            RoiYPercent = config.DigiEye.RoiYPercent,
            RoiWidthPercent = config.DigiEye.RoiWidthPercent,
            RoiHeightPercent = config.DigiEye.RoiHeightPercent
        }
    };
}
