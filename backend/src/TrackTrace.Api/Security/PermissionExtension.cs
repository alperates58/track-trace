using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace TrackTrace.Api.Security;

public static class PermissionExtension
{
    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder builder, string permissionKey)
    {
        return builder.AddEndpointFilter(new PermissionFilter(permissionKey));
    }
}
