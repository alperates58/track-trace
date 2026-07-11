using System;
using System.Text;
using System.Text.Json;

namespace TrackTrace.Application.Features.Orders;

public class OrderGroupPayload
{
    public string OrderNo { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
}

public static class OrderGroupKeyHelper
{
    public static string CreateGroupKey(string orderNo, string customerName)
    {
        var payload = new OrderGroupPayload
        {
            OrderNo = orderNo?.Trim() ?? string.Empty,
            CustomerName = customerName?.Trim() ?? string.Empty
        };

        var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var base64Url = Base64UrlEncode(jsonBytes);
        return $"v1.{base64Url}";
    }

    public static OrderGroupPayload DecodeGroupKey(string groupKey)
    {
        if (string.IsNullOrWhiteSpace(groupKey) || !groupKey.StartsWith("v1."))
        {
            throw new ArgumentException("Invalid group key format.");
        }

        var base64Url = groupKey.Substring(3);
        try
        {
            var jsonBytes = Base64UrlDecode(base64Url);
            var payload = JsonSerializer.Deserialize<OrderGroupPayload>(jsonBytes, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            if (payload == null || string.IsNullOrWhiteSpace(payload.OrderNo))
            {
                throw new ArgumentException("Invalid group key payload.");
            }
            return payload;
        }
        catch
        {
            throw new ArgumentException("Failed to decode group key.");
        }
    }

    private static string Base64UrlEncode(byte[] input)
    {
        var output = Convert.ToBase64String(input);
        output = output.Split('=')[0]; // Remove any trailing '='s
        output = output.Replace('+', '-'); // 62nd char of encoding
        output = output.Replace('/', '_'); // 63rd char of encoding
        return output;
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var output = input;
        output = output.Replace('-', '+'); // 62nd char of encoding
        output = output.Replace('_', '/'); // 63rd char of encoding
        switch (output.Length % 4) // Pad with trailing '='s
        {
            case 0: break; // No pad chars in this case
            case 2: output += "=="; break; // Two pad chars
            case 3: output += "="; break; // One pad char
            default: throw new ArgumentException("Illegal base64url string!");
        }
        return Convert.FromBase64String(output);
    }
}
