# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy solution and project files from institution-erp/backend
COPY institution-erp/backend/InstitutionErp.sln ./
COPY institution-erp/backend/src/InstitutionErp.Domain/InstitutionErp.Domain.csproj src/InstitutionErp.Domain/
COPY institution-erp/backend/src/InstitutionErp.Application/InstitutionErp.Application.csproj src/InstitutionErp.Application/
COPY institution-erp/backend/src/InstitutionErp.Infrastructure/InstitutionErp.Infrastructure.csproj src/InstitutionErp.Infrastructure/
COPY institution-erp/backend/src/InstitutionErp.Api/InstitutionErp.Api.csproj src/InstitutionErp.Api/
COPY institution-erp/backend/tests/InstitutionErp.UnitTests/InstitutionErp.UnitTests.csproj tests/InstitutionErp.UnitTests/
COPY institution-erp/backend/tests/InstitutionErp.IntegrationTests/InstitutionErp.IntegrationTests.csproj tests/InstitutionErp.IntegrationTests/

# Restore dependencies
RUN dotnet restore InstitutionErp.sln

# Copy source and publish
COPY institution-erp/backend/src/ src/
RUN dotnet publish src/InstitutionErp.Api/InstitutionErp.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install fontconfig and fonts for QuestPDF PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish ./

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:10000;http://+:8080;http://+:5050;http://+:80
ENV PORT=10000

EXPOSE 10000 8080 5050 80

ENTRYPOINT ["dotnet", "InstitutionErp.Api.dll"]
