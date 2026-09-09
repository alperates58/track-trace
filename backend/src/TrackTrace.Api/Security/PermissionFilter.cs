using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Api.Security;

public class PermissionFilter : IEndpointFilter
{
    private readonly string[] _permissionKeys;

    public PermissionFilter(params string[] permissionKeys)
    {
        _permissionKeys = permissionKeys;
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
            return Results.Forbid();
        }

        bool hasAny = false;
        foreach (var key in _permissionKeys)
        {
            if (await permissionService.HasPermissionAsync(currentUserService.UserId, role, key))
            {
                hasAny = true;
                break;
            }
        }

        if (!hasAny)
        {
            return Results.Forbid();
        }

        return await next(context);
    }
}
