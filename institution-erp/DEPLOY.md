# CampusCore (institution-erp) — Production Deployment Guide

See the comprehensive deployment manual in the repository root: [`DEPLOY.md`](../DEPLOY.md).

### Quick Reference Commands

- **Run Database Migrations:**
  ```powershell
  cd backend
  dotnet ef database update --project src/InstitutionErp.Infrastructure --startup-project src/InstitutionErp.Api
  ```
- **Build & Test Backend:**
  ```powershell
  cd backend
  dotnet build -c Release
  dotnet test
  ```
- **Build & Test Frontend:**
  ```powershell
  cd frontend
  npm ci
  npm run build
  npm run lint
  ```
- **Render Blueprint:** [`render.yaml`](./render.yaml)
- **Vercel Manifest:** [`frontend/vercel.json`](./frontend/vercel.json)
- **CI Workflow:** [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
