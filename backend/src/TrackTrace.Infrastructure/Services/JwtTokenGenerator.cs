using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using TrackTrace.Application.Common.Interfaces;

namespace TrackTrace.Infrastructure.Services;

public class JwtTokenGenerator : IJwtTokenGenerator
{
    private readonly string _secret;
    private readonly int _expiryHours;

    public JwtTokenGenerator(IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("Kritik Güvenlik Hatası: JWT Secret (Jwt:Secret) bulunamadı.");
        }
        _secret = secret;
        _expiryHours = int.TryParse(configuration["Jwt:ExpiryHours"], out var hours) ? hours : 24;
    }

    public string GenerateToken(Guid userId, string username, string name, string role)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_secret);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim("name", name),
                new Claim(ClaimTypes.Role, role)
            }),
            Expires = DateTime.UtcNow.AddHours(_expiryHours),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
