namespace TrackTrace.LocalAgent;

public sealed class DigiEyeFrameCache
{
    private readonly object _gate = new();
    private DigiEyeFrame? _latest;

    public void Set(DigiEyeFrame frame)
    {
        lock (_gate)
            _latest = frame;
    }

    public DigiEyeFrame? Get()
    {
        lock (_gate)
            return _latest;
    }
}
