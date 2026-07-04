using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using TrackTrace.Application.Common.Interfaces;
using Dapper;

namespace TrackTrace.Infrastructure.Services;

public class PermissionService : IPermissionService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public PermissionService(IDbConnectionFactory dbFactory, IMemoryCache cache)
    {
        _dbFactory = dbFactory;
        _cache = cache;
    }

    public async Task<bool> HasPermissionAsync(string role, string permissionKey)
    {
        if (string.IsNullOrEmpty(role) || string.IsNullOrEmpty(permissionKey))
            return false;

        string cacheKey = $"permissions_{role}";

        if (!_cache.TryGetValue(cacheKey, out HashSet<string>? rolePermissions))
        {
            using var db = _dbFactory.CreateConnection();
            var perms = await db.QueryAsync<string>(
                "SELECT PermissionKey FROM RolePermissions WHERE Role = @Role",
                new { Role = role }
            );

            rolePermissions = new HashSet<string>(perms ?? Enumerable.Empty<string>());
            
            _cache.Set(cacheKey, rolePermissions, CacheDuration);
        }

        return rolePermissions != null && rolePermissions.Contains(permissionKey);
    }
}
