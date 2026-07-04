using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Api.Security;

public class PermissionFilter : IEndpointFilter
{
    private readonly string _permissionKey;

    public PermissionFilter(string permissionKey)
    {
        _permissionKey = permissionKey;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var currentUserService = context.HttpContext.RequestServices.GetService(typeof(ICurrentUserService)) as ICurrentUserService;
        var permissionService = context.HttpContext.RequestServices.GetService(typeof(IPermissionService)) as IPermissionService;

        if (currentUserService == null || permissionService == null)
        {
            return Results.StatusCode(500);
        }

        var role = currentUserService.Role;

        if (string.IsNullOrEmpty(role))
        {
            // If there's no role, but it passed RequireAuthorization, maybe they have no role claim?
            // Existing logic for my-permissions returns empty list. Here we forbid.
            return Results.Forbid();
        }

        var hasPermission = await permissionService.HasPermissionAsync(currentUserService.UserId, role, _permissionKey);

        if (!hasPermission)
        {
            return Results.Forbid();
        }

        return await next(context);
    }
}
