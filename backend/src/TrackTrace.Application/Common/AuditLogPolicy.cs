using System;
using System.Collections.Generic;

namespace TrackTrace.Application.Common;

public static class AuditLogPolicy
{
    private static readonly IReadOnlyDictionary<string, HashSet<string>> CriticalActionsByEntity =
        new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["Users"] = Actions("Create", "Update", "ToggleActive"),
            ["Stations"] = Actions("Create", "Update"),
            ["Orders"] = Actions(
                "Create",
                "Update",
                "Activate",
                "Complete",
                "Cancel",
                "Delete",
                "ClearProductCodes",
                "PrePrintCartonsGenerated"),
            ["OrderGroups"] = Actions("DeleteGroup"),
            ["ImportBatches"] = Actions("Import", "DeleteBatch"),
            ["CartonBatch"] = Actions("MarkPrinted"),
            ["Cartons"] = Actions(
                "Close",
                "Decompose",
                "EmptyContents",
                "RemoveProduct",
                "TransferStation",
                "TransferUser",
                "Voided",
                "Reprint",
                "PrePrintedOpened"),
            ["Pallets"] = Actions("Close", "TransferCarton", "Delete"),
            ["ProductCodes"] = Actions("DoubleScanAttempt"),
            ["Shipments"] = Actions(
                "RemoveItem",
                "Complete",
                "ReverseShipment",
                "Cancel",
                "DeleteCancelled")
        };

    public static bool ShouldLog(string entityName, string action)
    {
        if (string.IsNullOrWhiteSpace(entityName) || string.IsNullOrWhiteSpace(action))
        {
            return false;
        }

        return CriticalActionsByEntity.TryGetValue(entityName, out var actions)
            && actions.Contains(action);
    }

    private static HashSet<string> Actions(params string[] actions) =>
        new(actions, StringComparer.OrdinalIgnoreCase);
}
