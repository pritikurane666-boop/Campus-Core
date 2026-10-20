# CampusCore Enterprise Institution ERP

A production-grade, full-stack **Digital Educational Institution Management System (ERP)** built strictly following Clean Architecture principles, RFC 7807 problem details, and modern web engineering best practices.

---

## 🏛️ System Architecture

- **Backend**: ASP.NET Core 8 Web API, C#, Entity Framework Core 8 with Npgsql, PostgreSQL 16/18, BCrypt, QuestPDF, Serilog, FluentValidation.
- **Frontend**: React 18/19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form + Zod, Axios, Chart.js (`react-chartjs-2`), Lucide React.
- **Persistence**: PostgreSQL relational database with snake_case naming conventions, soft delete global query filters, unique constraints, and audit trails.
- **Clean Architecture Layers**:
  - `InstitutionErp.Domain`: Core domain entities, enums, aggregate roots.
  - `InstitutionErp.Application`: CQRS/Repository interfaces, DTOs, FluentValidation rules.
  - `InstitutionErp.Infrastructure`: EF Core DbContext, BCrypt hasher, JWT tokens, QuestPDF generators, local file store, Notification outbox worker.
  - `InstitutionErp.Api`: ASP.NET Core 8 Web API with Swagger/OpenAPI, RFC 7807 error handling, rate limiting, Serilog request logging.

---

## 🚀 Quick Start Guide

### Prerequisites
- .NET 8 SDK
- Node.js 18+ & npm
- PostgreSQL 15+ (Running on port 5432) OR Docker / Docker Compose

### 1. Database Setup
Ensure PostgreSQL is running locally with user `postgres` and password `root` (or update `appsettings.Development.json`):
```sql
CREATE DATABASE institution_erp;
```

### 2. Run Backend API
```powershell
cd "d:\CLG APP\institution-erp\backend"
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --project "src\InstitutionErp.Api\InstitutionErp.Api.csproj" --urls "http://localhost:5050"
```
The API server automatically runs database migrations and seeds initial demo data on startup!
- API Base URL: `http://localhost:5050`
- Swagger UI Documentation: `http://localhost:5050/swagger`
- Health Check: `http://localhost:5050/api/v1/health`

### 3. Run React Frontend
```powershell
cd "d:\CLG APP\institution-erp\frontend"
npm install
npm run dev -- --port 3000
```
- Frontend Application URL: `http://localhost:3000`

---

## 🐳 Docker Deployment
To launch the complete ERP stack using Docker Compose:
```bash
docker-compose up --build -d
```
- React SPA: `http://localhost:3000`
- API Backend: `http://localhost:5050`
- PostgreSQL: `localhost:5432`

---

## 🔐 Role-Based Access & Dynamic Generated Credentials

Accounts and credentials in CampusCore ERP are purely dynamic and generated according to institutional rules:

| Role | Access & Rules |
|---|---|
| **Principal / Admin** | Configured via `appsettings.json` (`Admin:Email` & `Admin:Password`). Full executive governance, operations, admissions, fees, timetable, staff, and system audit trail. |
| **Teacher** | Default dynamic formula upon staff creation: `FirstName$EmployeeCode` (e.g. `Sarah$TCH-001`). Access to daily lecture timetable, student attendance marking, and examination grading. |
| **Student** | Default dynamic formula upon enrollment approval: `first3lettersofemail@rollNumber` (e.g. `stu@101`). Access to student academic portal, weekly timetable, term attendance, report card download, fees, and notices. |

All roles can also reset their password securely via their profile or the Forgot Password workflow, and Administrators can reset staff and student passwords anytime.

---

## ✨ Implemented Modules & Capabilities

1. **Role-Based Executive Dashboards**
   - **Principal**: Student/teacher counts, fee recovery rate, live turnout doughnut, 6-month collection bars, 30-day attendance health curve, admissions review, fee ledger.
   - **Teacher**: Daily lecture timetable with room numbers, assigned cohorts, pending exam grading queue.
   - **Student**: Term attendance percentage, fees due, weekly timetable, exam results, campus circulars.
2. **Online Admissions & Workflow Engine**
   - Public multi-step application form with document uploads.
   - Real-time application reference tracker (`ADM-YYYY-####`).
   - Principal review queue with **One-Click Approval** that automatically provisions:
     - Enrolled Student Profile + Roll Number
     - Student Portal User Account
     - Emergency Guardian Contact Information
3. **Classrooms & Interactive Timetable Matrix**
   - Classroom cohorts, seat capacity, section management.
   - Weekly 6-period visual timetable grid with automatic teacher clash prevention.
4. **Daily Student & Faculty Attendance**
   - Instant "Mark All Present" one-click action with status toggles (Present, Absent, Late, Excused).
   - Automated absence notification dispatch.
   - Low attendance watchlist (< 75% threshold).
5. **Examinations, Scoring & QuestPDF Report Cards**
   - Exam scheduling and subject weightages.
   - Teacher marks entry with absent validation and pass/fail thresholds.
   - One-click results publishing.
   - High-fidelity **QuestPDF Report Card** downloads with institution branding.
6. **Fee Management & Defaulters Tracking**
   - Multi-head fee structures (Tuition, Admission, Lab, Sports).
   - Counter payment recording (Cash, Card, UPI, Bank Transfer, Cheque).
   - Official **QuestPDF Payment Receipts** generation (`REC-YYYY-####`).
   - Defaulters arrears ledger with CSV export.
7. **Campus Noticeboard & Compliance Audit Trail**
   - Circulars broadcasting with audience targeting (All, Principal, Teacher, Student).
   - Immutable security and state audit trail with JSON payload inspection.
