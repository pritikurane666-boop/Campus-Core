# CampusCore (institution-erp) — Production Deployment Guide

This document provides a comprehensive, step-by-step production deployment manual for the **CampusCore Enterprise Resource Planning (ERP)** system.

---

## 1. System Architecture Topology

The production architecture separates the stateless web application, the containerized .NET 8 Web API, and managed cloud storage/database services to ensure zero preflight latency, enterprise-grade data isolation, and high availability:

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER                       │
│    (Role-based UI: Principal, Teacher, Student)        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (Port 443)
                           ▼
┌────────────────────────────────────────────────────────┐
│               VERCEL EDGE NETWORK (SPA)                │
│  - Static Asset Delivery (Vite + React 19 Bundle)      │
│  - Zero-CORS Reverse-Proxy: /api/* -> Render API       │
│  - Security Headers: DENY, nosniff, strict-origin      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS /api/v1/*
                           ▼
┌────────────────────────────────────────────────────────┐
│           RENDER CONTAINER SERVICE (.NET 8)            │
│  - Kestrel Web Server (Dynamic $PORT Binding)          │
│  - Clean Architecture (Api, Application, Domain, Infra)│
│  - RFC 7807 ProblemDetails + FluentValidation Filter   │
│  - QuestPDF Native Engine (libfontconfig1, DejaVu)     │
│  - Outbox Background Hosted Service (300/day Brevo Cap)│
└────────────┬──────────────────┬─────────────────┬──────┘
             │                  │                 │
             ▼                  ▼                 ▼
┌─────────────────────────┐┌───────────────┐┌───────────────┐
│  SUPABASE POSTGRESQL    ││SUPABASE PRIV. ││  BREVO HTTPS  │
│  - Managed PostgreSQL 16││   STORAGE     ││TRANSACTIONAL  │
│  - Session Pooler (:5432││- Private S3   ││  EMAIL API    │
│  - NpgsqlRetryingStrategy││  Bucket Proxy ││- 300/day Cap  │
│  - Atomic Sequences     ││- Server-Side  ││- Retry Backoff│
│  - Role Hardening       ││  Service Key  ││- DeadLetter Q │
└─────────────────────────┘└───────────────┘└───────────────┘
```

---

## 2. Pre-Deployment Credentials Checklist

Gather the following production credentials before deploying:

| Service | Environment Variable | Example / Description |
|---|---|---|
| **Supabase DB** | `ConnectionStrings__DefaultConnection` | `Host=aws-0-us-east-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.[ref];Password=[pwd];SslMode=Require;Trust Server Certificate=true;Pooling=true;Maximum Pool Size=25;` |
| **Auth JWT** | `Jwt__Secret` | 256-bit cryptographically secure string (min 32 bytes) |
| **Auth JWT** | `Jwt__Issuer` | `InstitutionErp` |
| **Auth JWT** | `Jwt__Audience` | `InstitutionErpApp` |
| **Admin Seed** | `Admin__Email` | `principal@institution.edu` |
| **Admin Seed** | `Admin__Password` | Initial strong password (forced change on first login) |
| **Admin Seed** | `Admin__FullName` | `Dr. Alexander Wright` |
| **Brevo Email** | `Email__ApiKey` | `xkeysib-...` (From Brevo API Keys dashboard) |
| **Brevo Email** | `Email__FromAddress` | Verified sender email in Brevo (e.g. `notifications@institution.edu`) |
| **Brevo Email** | `Email__FromName` | `CampusCore ERP` |
| **Brevo Email** | `Email__DailyLimit` | `300` |
| **Supabase Storage** | `Supabase__Url` | `https://[ref].supabase.co` |
| **Supabase Storage** | `Supabase__ServiceRoleKey` | Supabase `service_role` private API secret |
| **Supabase Storage** | `Supabase__StorageBucket` | `campuscore-documents` |

---

## 3. Database Setup (Supabase PostgreSQL)

### 3.1 Connection String Configuration
1. Open your **Supabase Dashboard** -> Project Settings -> **Database**.
2. Select **Connection Pooling** -> Mode: **Session** (Port `5432`).
3. Copy the URI and format as an Npgsql connection string:
   ```text
   Host=aws-0-[region].pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.[project-ref];Password=[your-db-password];SslMode=Require;Trust Server Certificate=true;Pooling=true;Maximum Pool Size=25;
   ```

### 3.2 Running Entity Framework Core Migrations
Execute database migrations against your Supabase instance from your local workstation or CI runner:

```powershell
cd "d:\CLG APP\institution-erp\backend"

$env:ConnectionStrings__DefaultConnection = "Host=...;Port=5432;Database=postgres;Username=...;Password=...;SslMode=Require;Trust Server Certificate=true;"

dotnet ef database update --project src/InstitutionErp.Infrastructure --startup-project src/InstitutionErp.Api
```

> [!NOTE]
> All primary database tables, atomic sequence generators (`seq_student_code`, `seq_admission_code`, `seq_teacher_code`, `seq_receipt_number`), and role-based constraint indexes will be created automatically.

---

## 4. Supabase Storage Setup (Private Documents Bucket)

Admissions documents and institutional file uploads are stored in an encrypted private bucket, never accessible to anonymous public traffic:

1. In Supabase Dashboard, navigate to **Storage**.
2. Click **New Bucket**.
   - Name: `campuscore-documents`
   - Public Bucket: **Disabled (Unchecked)**
3. Under Project Settings -> **API**, locate the `service_role` secret token.
4. Set `Supabase__ServiceRoleKey` in your backend environment variables. The API acts as an authenticated streaming proxy for document access (`GET /api/v1/admissions/{id}/documents/{docId}/download`).

---

## 5. Email Notifications Setup (Brevo HTTPS Transactional API)

1. Sign up or log into **Brevo** ([brevo.com](https://brevo.com)).
2. Navigate to **Senders, Domains & Dedicated IPs** -> Add and verify your sender email or institutional domain.
3. Navigate to **SMTP & API** -> **API Keys** -> Generate a new v3 API Key.
4. Set `Email__Provider=Brevo` and paste your key into `Email__ApiKey`.
5. The built-in outbox background service (`NotificationOutboxWorker`) guarantees:
   - Max 300 emails/day guard to adhere to free tier limits.
   - Non-critical notices remain `Pending` for the next day when cap is reached.
   - High-priority security emails (password change slips, reset tokens) take precedence.
   - Exponential backoff with 3 retries on network failures before dead-lettering.

---

## 6. Backend API Deployment (Render Docker Web Service)

### Method A: Infrastructure as Code (render.yaml Blueprint)
1. Commit the provided [`render.yaml`](file:///d:/CLG%20APP/render.yaml) to your repository root.
2. In the **Render Dashboard**, select **New +** -> **Blueprint**.
3. Connect your repository. Render will automatically detect `render.yaml` and configure the `campuscore-api` Docker service.
4. Enter the un-synced secrets when prompted (`ConnectionStrings__DefaultConnection`, `Jwt__Secret`, `Admin__Password`, `Email__ApiKey`, `Supabase__ServiceRoleKey`).
5. Click **Apply**.

### Method B: Manual Web Service Setup
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Select your repository -> Environment: **Docker**.
3. Settings:
   - **Name:** `campuscore-api`
   - **Region:** Oregon (US West) or closest to Supabase region
   - **Root Directory:** (leave blank)
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `.`
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** Yes
4. Add all environment variables listed in Section 2.
5. Deploy service. Verify health check at:
   `https://campus-core-nwlt.onrender.com/health` (should return HTTP 200 `Healthy`).

---

## 7. Frontend SPA Deployment (Vercel)

The frontend is deployed to Vercel with automatic reverse-proxy rewrites configured in [`vercel.json`](file:///d:/CLG%20APP/institution-erp/frontend/vercel.json):

1. In **Vercel Dashboard**, click **Add New...** -> **Project**.
2. Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `institution-erp/frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. In `vercel.json`, ensure the API rewrite destination points to your Render backend service:
   ```json
   {
     "source": "/api/(.*)",
     "destination": "https://campus-core-nwlt.onrender.com/api/$1"
   }
   ```
5. Deploy. Vercel will build the frontend in ~2 seconds and issue an SSL certificate.

---

## 8. Initial Bootstrapping & Security Smoke Testing

Once both services are active:

1. **Verify Backend Health:**
   ```bash
   curl -i https://campus-core-nwlt.onrender.com/health
   # Response: HTTP 200 OK (Healthy)
   ```

2. **Verify Frontend Access:**
   Visit your Vercel deployment URL (e.g. `https://campuscore.vercel.app`).

3. **First-Time Principal Login:**
   - Email: `Admin__Email` value (e.g. `principal@institution.edu`)
   - Password: `Admin__Password` value
   - System prompts the mandatory `MustChangePasswordModal` dialog. Enter a new, permanent password.

4. **Verify Role Isolation:**
   - Principal has access to Admissions, Students, Teachers, Classes, Fees, and Exams.
   - Teachers can only mark attendance and grades for their allocated subjects.
   - Students only see their own attendance, grades, and fee receipts.

5. **Verify QuestPDF Receipts:**
   - Navigate to **Fee Operations** -> Click **PDF** on any transaction -> Confirm QuestPDF generates the receipt with zero font-rendering errors.

---

## 9. Rollback & Maintenance Procedures

- **Database Rollback:** If an EF Core migration must be rolled back:
  ```powershell
  dotnet ef database update <PreviousMigrationName> --project src/InstitutionErp.Infrastructure --startup-project src/InstitutionErp.Api
  ```
- **Outbox Recovery:** If Brevo runs out of credits or experiences transient outages, pending notification rows remain safely queued in table `notifications` with `delivery_status = 'Pending'`. They automatically resume once the service recovers.
- **Credential Recovery:** If a staff member loses their password, the Principal can issue a fresh 14-character CSPRNG temporary password from the Teachers or Students directory, returning a new single-issuance `CredentialSlipModal`.
