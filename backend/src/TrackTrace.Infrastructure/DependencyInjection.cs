using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TrackTrace.Application.Common.Interfaces;
using TrackTrace.Infrastructure.Data;
using TrackTrace.Infrastructure.Services;

namespace TrackTrace.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<ILabelGenerator, LabelGenerator>();
        services.AddScoped<IReportPdfGenerator, ReportPdfGenerator>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddHttpContextAccessor();
        return services;
    }
}
