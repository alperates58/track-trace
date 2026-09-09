using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace TrackTrace.Api.Security;

public static class PermissionExtension
{
    public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder builder, params string[] permissionKeys)
    {
        return builder.AddEndpointFilter(new PermissionFilter(permissionKeys));
    }
}
