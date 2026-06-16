using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using FluentValidation;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Application.Features.Users;

public record GetUsersQuery : IRequest<IEnumerable<UserDto>>;

public record CreateUserRequest(string Name, string Username, string Password, string Role);
public record CreateUserCommand(CreateUserRequest Request) : IRequest<Guid>;

public record UpdateUserRequest(string Name, string Username, string? Password, string Role, bool IsActive);
public record UpdateUserCommand(Guid Id, UpdateUserRequest Request) : IRequest<Unit>;

public record ToggleUserActiveCommand(Guid Id) : IRequest<Unit>;

#region Validators

public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Request.Name).NotEmpty().WithMessage("İsim boş olamaz.");
        RuleFor(x => x.Request.Username).NotEmpty().WithMessage("Kullanıcı adı boş olamaz.");
        RuleFor(x => x.Request.Password).NotEmpty().MinimumLength(6).WithMessage("Şifre en az 6 karakter olmalıdır.");
        RuleFor(x => x.Request.Role).Must(role => role == "Admin" || role == "Operator" || role == "Viewer")
            .WithMessage("Geçersiz rol seçimi.");
    }
}

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.Request.Name).NotEmpty().WithMessage("İsim boş olamaz.");
        RuleFor(x => x.Request.Username).NotEmpty().WithMessage("Kullanıcı adı boş olamaz.");
        RuleFor(x => x.Request.Password).Must(p => string.IsNullOrEmpty(p) || p.Length >= 6)
            .WithMessage("Şifre en az 6 karakter olmalıdır.");
        RuleFor(x => x.Request.Role).Must(role => role == "Admin" || role == "Operator" || role == "Viewer")
            .WithMessage("Geçersiz rol seçimi.");
    }
}

#endregion

#region Handlers

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, IEnumerable<UserDto>>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;

    public GetUsersQueryHandler(IDbConnectionFactory dbConnectionFactory)
    {
        _dbConnectionFactory = dbConnectionFactory;
    }

    public async Task<IEnumerable<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = "SELECT Id, Name, Username, Role, IsActive FROM Users ORDER BY CreatedAt DESC";
        
        var users = await connection.QueryAsync<dynamic>(sql);
        var result = new List<UserDto>();

        foreach (var u in users)
        {
            result.Add(new UserDto(
                (Guid)u.id,
                (string)u.name,
                (string)u.username,
                (string)u.role,
                (bool)u.isactive
            ));
        }

        return result;
    }
}

public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, Guid>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IAuditLogService _auditLogService;

    public CreateUserCommandHandler(IDbConnectionFactory dbConnectionFactory, IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _auditLogService = auditLogService;
    }

    public async Task<Guid> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        var req = request.Request;
        using var connection = _dbConnectionFactory.CreateConnection();

        // Check unique username
        const string checkSql = "SELECT EXISTS(SELECT 1 FROM Users WHERE Username = @Username)";
        var exists = await connection.ExecuteScalarAsync<bool>(checkSql, new { Username = req.Username });
        if (exists)
        {
            throw new InvalidOperationException("Bu kullanıcı adı zaten alınmış.");
        }

        var newId = Guid.NewGuid();
        string passwordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        const string insertSql = @"
            INSERT INTO Users (Id, Name, Username, PasswordHash, Role, IsActive, CreatedAt)
            VALUES (@Id, @Name, @Username, @PasswordHash, @Role, TRUE, @CreatedAt)";

        await connection.ExecuteAsync(insertSql, new
        {
            Id = newId,
            Name = req.Name,
            Username = req.Username,
            PasswordHash = passwordHash,
            Role = req.Role,
            CreatedAt = DateTime.UtcNow
        });

        await _auditLogService.LogAsync("Users", newId, "Create", null, new { Username = req.Username, Role = req.Role });

        return newId;
    }
}

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand, Unit>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public UpdateUserCommandHandler(
        IDbConnectionFactory dbConnectionFactory, 
        IAuditLogService auditLogService,
        ICurrentUserService currentUserService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    public async Task<Unit> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        var req = request.Request;
        using var connection = _dbConnectionFactory.CreateConnection();

        // Check if username unique to others
        const string checkSql = "SELECT EXISTS(SELECT 1 FROM Users WHERE Username = @Username AND Id != @Id)";
        var exists = await connection.ExecuteScalarAsync<bool>(checkSql, new { Username = req.Username, Id = request.Id });
        if (exists)
        {
            throw new InvalidOperationException("Bu kullanıcı adı başka bir kullanıcı tarafından kullanılıyor.");
        }

        // Prevent self-deactivation of Admin
        if (_currentUserService.UserId == request.Id && !req.IsActive)
        {
            throw new InvalidOperationException("Kendi hesabınızı pasifleştiremezsiniz.");
        }

        string updateSql;
        object parameters;

        if (!string.IsNullOrEmpty(req.Password))
        {
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
            updateSql = @"
                UPDATE Users 
                SET Name = @Name, Username = @Username, PasswordHash = @PasswordHash, Role = @Role, IsActive = @IsActive
                WHERE Id = @Id";
            
            parameters = new
            {
                Id = request.Id,
                Name = req.Name,
                Username = req.Username,
                PasswordHash = passwordHash,
                Role = req.Role,
                IsActive = req.IsActive
            };
        }
        else
        {
            updateSql = @"
                UPDATE Users 
                SET Name = @Name, Username = @Username, Role = @Role, IsActive = @IsActive
                WHERE Id = @Id";
            
            parameters = new
            {
                Id = request.Id,
                Name = req.Name,
                Username = req.Username,
                Role = req.Role,
                IsActive = req.IsActive
            };
        }

        await connection.ExecuteAsync(updateSql, parameters);

        await _auditLogService.LogAsync("Users", request.Id, "Update", null, new { Username = req.Username, Role = req.Role, IsActive = req.IsActive });

        return Unit.Value;
    }
}

public class ToggleUserActiveCommandHandler : IRequestHandler<ToggleUserActiveCommand, Unit>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserService _currentUserService;

    public ToggleUserActiveCommandHandler(
        IDbConnectionFactory dbConnectionFactory, 
        IAuditLogService auditLogService,
        ICurrentUserService currentUserService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _auditLogService = auditLogService;
        _currentUserService = currentUserService;
    }

    public async Task<Unit> Handle(ToggleUserActiveCommand request, CancellationToken cancellationToken)
    {
        // Prevent self deactivation
        if (_currentUserService.UserId == request.Id)
        {
            throw new InvalidOperationException("Kendi hesabınızın aktiflik durumunu değiştiremezsiniz.");
        }

        using var connection = _dbConnectionFactory.CreateConnection();
        
        const string toggleSql = "UPDATE Users SET IsActive = NOT IsActive WHERE Id = @Id";
        await connection.ExecuteAsync(toggleSql, new { Id = request.Id });

        await _auditLogService.LogAsync("Users", request.Id, "ToggleActive");

        return Unit.Value;
    }
}

#endregion
