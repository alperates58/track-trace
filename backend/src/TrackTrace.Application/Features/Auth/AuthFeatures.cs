using System;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using FluentValidation;
using MediatR;
using TrackTrace.Application.Common;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Domain.Enums;

namespace TrackTrace.Application.Features.Auth;

public record LoginCommand(string Username, string Password) : IRequest<LoginResponse>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Username).NotEmpty().WithMessage("Kullanıcı adı boş olamaz.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Şifre boş olamaz.");
    }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IAuditLogService _auditLogService;

    public LoginCommandHandler(
        IDbConnectionFactory dbConnectionFactory,
        IJwtTokenGenerator jwtTokenGenerator,
        IAuditLogService auditLogService)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _jwtTokenGenerator = jwtTokenGenerator;
        _auditLogService = auditLogService;
    }

    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        using var connection = _dbConnectionFactory.CreateConnection();
        const string sql = @"
            SELECT u.*, s.Name AS defaultstationname 
            FROM Users u 
            LEFT JOIN Stations s ON u.DefaultStationId = s.Id 
            WHERE LOWER(u.Username) = LOWER(@Username) 
            LIMIT 1";
        
        var user = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { Username = request.Username });
        if (user == null)
        {
            throw new UnauthorizedAccessException("Kullanıcı adı veya şifre hatalı.");
        }

        bool isActive = user.isactive;
        if (!isActive)
        {
            throw new UnauthorizedAccessException("Kullanıcı hesabı pasif durumdadır.");
        }

        string passwordHash = user.passwordhash;
        if (!BCrypt.Net.BCrypt.Verify(request.Password, passwordHash))
        {
            throw new UnauthorizedAccessException("Kullanıcı adı veya şifre hatalı.");
        }

        Guid userId = user.id;
        string name = user.name;
        string username = user.username;
        string roleStr = user.role;
        
        string token = _jwtTokenGenerator.GenerateToken(userId, username, name, roleStr);

        const string updateLastLoginSql = "UPDATE Users SET LastLoginAt = CURRENT_TIMESTAMP WHERE Id = @UserId";
        await connection.ExecuteAsync(updateLastLoginSql, new { UserId = userId });

        DateTime now = DateTime.UtcNow;
        var userDto = new UserDto(
            userId, 
            name, 
            username, 
            roleStr, 
            isActive, 
            user.defaultstationid != null ? (Guid?)user.defaultstationid : null, 
            (string?)user.defaultstationname, 
            now, 
            user.createdat != null ? (DateTime?)user.createdat : null
        );

        await _auditLogService.LogAsync("Users", userId, "Login");

        return new LoginResponse(token, userDto);
    }
}
