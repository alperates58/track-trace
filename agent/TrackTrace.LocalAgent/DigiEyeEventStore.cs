using System.Text.Json;

namespace TrackTrace.LocalAgent;

public sealed class DigiEyeEventStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };
    private readonly object _gate = new();
    private readonly string _path;
    private DigiEyeQueueState _state;

    public DigiEyeEventStore(string dataDirectory)
    {
        _path = Path.Combine(dataDirectory, "digieye.queue.json");
        _state = Load();
    }

    public int PendingCount
    {
        get
        {
            lock (_gate)
                return _state.Pending.Count;
        }
    }

    public DigiEyeEvent Add(string rawCode, string format, DateTimeOffset capturedAtUtc, int decodeMilliseconds, string source)
    {
        lock (_gate)
        {
            var item = new DigiEyeEvent(
                _state.NextSequence++,
                rawCode,
                format,
                capturedAtUtc,
                decodeMilliseconds,
                source);
            _state.Pending.Add(item);
            SaveLocked();
            return item;
        }
    }

    public IReadOnlyList<DigiEyeEvent> GetAfter(long afterSequence, int limit)
    {
        lock (_gate)
            return _state.Pending
                .Where(item => item.Sequence > afterSequence)
                .OrderBy(item => item.Sequence)
                .Take(Math.Clamp(limit, 1, 100))
                .ToArray();
    }

    public DigiEyeAcknowledgeResult Acknowledge(long sequence)
    {
        lock (_gate)
        {
            if (sequence <= _state.LastAcknowledgedSequence)
                return DigiEyeAcknowledgeResult.AlreadyAcknowledged;

            if (_state.Pending.Count == 0 || _state.Pending[0].Sequence != sequence)
                return DigiEyeAcknowledgeResult.OutOfOrder;

            _state.Pending.RemoveAt(0);
            _state.LastAcknowledgedSequence = sequence;
            SaveLocked();
            return DigiEyeAcknowledgeResult.Acknowledged;
        }
    }

    private DigiEyeQueueState Load()
    {
        if (!File.Exists(_path))
            return new DigiEyeQueueState();

        try
        {
            var state = JsonSerializer.Deserialize<DigiEyeQueueState>(File.ReadAllText(_path))
                ?? new DigiEyeQueueState();
            var highestSequence = state.Pending.Count == 0 ? 0 : state.Pending.Max(item => item.Sequence);
            state.NextSequence = Math.Max(state.NextSequence, Math.Max(highestSequence, state.LastAcknowledgedSequence) + 1);
            return state;
        }
        catch
        {
            var corruptPath = _path + ".corrupt-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            File.Move(_path, corruptPath, true);
            return new DigiEyeQueueState();
        }
    }

    private void SaveLocked()
    {
        var temporaryPath = _path + ".tmp";
        File.WriteAllText(temporaryPath, JsonSerializer.Serialize(_state, JsonOptions));
        File.Move(temporaryPath, _path, true);
    }
}
