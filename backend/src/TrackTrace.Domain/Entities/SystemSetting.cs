namespace TrackTrace.Domain.Entities;

public class SystemSetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Key { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;
    public string? UpdatedBy { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private SystemSetting() { }

    public SystemSetting(string key, string value, string? updatedBy)
    {
        Key = key;
        Value = value;
        UpdatedBy = updatedBy;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateValue(string value, string? updatedBy)
    {
        Value = value;
        UpdatedBy = updatedBy;
        UpdatedAt = DateTime.UtcNow;
    }
}
