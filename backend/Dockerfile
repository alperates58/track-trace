FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy and restore as distinct layers
COPY TrackTrace.sln ./
COPY src/TrackTrace.Domain/TrackTrace.Domain.csproj ./src/TrackTrace.Domain/
COPY src/TrackTrace.Application/TrackTrace.Application.csproj ./src/TrackTrace.Application/
COPY src/TrackTrace.Infrastructure/TrackTrace.Infrastructure.csproj ./src/TrackTrace.Infrastructure/
COPY src/TrackTrace.Api/TrackTrace.Api.csproj ./src/TrackTrace.Api/

RUN dotnet restore TrackTrace.sln

# Copy everything else and build
COPY src/ ./src/
RUN dotnet publish src/TrackTrace.Api/TrackTrace.Api.csproj -c Release -o /out

# Build runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out ./

# Copy migrations folder so it's accessible at runtime
COPY src/TrackTrace.Infrastructure/Data/Migrations/ ./Data/Migrations/

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "TrackTrace.Api.dll"]
