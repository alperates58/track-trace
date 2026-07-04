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

    public async Task<bool> HasPermissionAsync(Guid? userId, string role, string permissionKey)
    {
        if (string.IsNullOrEmpty(role) || string.IsNullOrEmpty(permissionKey))
            return false;

        string roleCacheKey = $"permissions_{role}";

        if (!_cache.TryGetValue(roleCacheKey, out HashSet<string>? rolePermissions))
        {
            using var db = _dbFactory.CreateConnection();
            var perms = await db.QueryAsync<string>(
                "SELECT PermissionKey FROM RolePermissions WHERE Role = @Role",
                new { Role = role }
            );

            rolePermissions = new HashSet<string>(perms ?? Enumerable.Empty<string>());
            
            _cache.Set(roleCacheKey, rolePermissions, CacheDuration);
        }
        
        bool hasRolePerm = rolePermissions != null && rolePermissions.Contains(permissionKey);

        if (userId.HasValue)
        {
            string userCacheKey = $"user_permissions_{userId.Value}";
            if (!_cache.TryGetValue(userCacheKey, out Dictionary<string, bool>? userPermissions))
            {
                using var db = _dbFactory.CreateConnection();
                var userPerms = await db.QueryAsync<(string Key, bool IsGranted)>(
                    "SELECT PermissionKey, IsGranted FROM UserPermissions WHERE UserId = @UserId",
                    new { UserId = userId.Value }
                );
                
                userPermissions = userPerms.ToDictionary(x => x.Key, x => x.IsGranted);
                _cache.Set(userCacheKey, userPermissions, CacheDuration);
            }
            
            if (userPermissions != null && userPermissions.TryGetValue(permissionKey, out bool isGranted))
            {
                return isGranted; // User override takes precedence
            }
        }

        return hasRolePerm;
    }
}
