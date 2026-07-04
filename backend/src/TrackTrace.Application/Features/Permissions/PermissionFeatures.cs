using System.Data;
using Dapper;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Permissions;

// DTOs
public record PermissionDto(string Key, string Module, string Action, string? Description);
public record RolePermissionDto(string Role, string PermissionKey);

public record PermissionMatrixResponse(List<PermissionDto> Permissions, List<RolePermissionDto> RolePermissions);

// Queries
public record GetPermissionMatrixQuery() : IRequest<PermissionMatrixResponse>;

public class GetPermissionMatrixHandler : IRequestHandler<GetPermissionMatrixQuery, PermissionMatrixResponse>
{
    private readonly IDbConnectionFactory _dbFactory;

    public GetPermissionMatrixHandler(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<PermissionMatrixResponse> Handle(GetPermissionMatrixQuery request, CancellationToken cancellationToken)
    {
        using var _db = _dbFactory.CreateConnection();
        var permissions = await _db.QueryAsync<PermissionDto>("SELECT Key, Module, Action, Description FROM Permissions ORDER BY Module, Action");
        var rolePermissions = await _db.QueryAsync<RolePermissionDto>("SELECT Role, PermissionKey FROM RolePermissions");

        return new PermissionMatrixResponse(permissions.ToList(), rolePermissions.ToList());
    }
}

public record GetMyPermissionsQuery() : IRequest<List<string>>;

public class GetMyPermissionsHandler : IRequestHandler<GetMyPermissionsQuery, List<string>>
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ICurrentUserService _currentUserService;

    public GetMyPermissionsHandler(IDbConnectionFactory dbFactory, ICurrentUserService currentUserService)
    {
        _dbFactory = dbFactory;
        _currentUserService = currentUserService;
    }

    public async Task<List<string>> Handle(GetMyPermissionsQuery request, CancellationToken cancellationToken)
    {
        var role = _currentUserService.Role;
        if (string.IsNullOrEmpty(role))
            return new List<string>();

        using var _db = _dbFactory.CreateConnection();
        var rolePerms = await _db.QueryAsync<string>("SELECT PermissionKey FROM RolePermissions WHERE Role = @Role", new { Role = role });
        
        var finalPermissions = new HashSet<string>(rolePerms ?? Enumerable.Empty<string>());

        if (_currentUserService.UserId.HasValue)
        {
            var userPerms = await _db.QueryAsync<(string Key, bool IsGranted)>(
                "SELECT PermissionKey, IsGranted FROM UserPermissions WHERE UserId = @UserId", 
                new { UserId = _currentUserService.UserId.Value });

            foreach (var perm in userPerms)
            {
                if (perm.IsGranted)
                    finalPermissions.Add(perm.Key);
                else
                    finalPermissions.Remove(perm.Key);
            }
        }

        return finalPermissions.ToList();
    }
}

// Commands
public record UpdatePermissionMatrixCommand(List<RolePermissionDto> Assignments) : IRequest<bool>;

public class UpdatePermissionMatrixHandler : IRequestHandler<UpdatePermissionMatrixCommand, bool>
{
    private readonly IDbConnectionFactory _dbFactory;

    public UpdatePermissionMatrixHandler(IDbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task<bool> Handle(UpdatePermissionMatrixCommand request, CancellationToken cancellationToken)
    {
        using var _db = _dbFactory.CreateConnection();
        if (_db.State != ConnectionState.Open) _db.Open();
        using var transaction = _db.BeginTransaction();
        try
        {
            await _db.ExecuteAsync("DELETE FROM RolePermissions", transaction: transaction);
            
            if (request.Assignments != null && request.Assignments.Count > 0)
            {
                var sql = "INSERT INTO RolePermissions (Role, PermissionKey) VALUES (@Role, @PermissionKey)";
                await _db.ExecuteAsync(sql, request.Assignments, transaction: transaction);
            }
            
            transaction.Commit();
            return true;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }
}
