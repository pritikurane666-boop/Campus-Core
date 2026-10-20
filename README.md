# CampusCore

A web-based ERP for managing a college or school: admissions, students, teachers, classes, timetables, attendance, exams and results, fees, and notices, with separate dashboards for each role.

> **Status:** active development. A hardening and production-readiness pass is in progress.

## Features

- **Admissions:** public online application, document upload, review and approval workflow, automatic enrollment on approval
- **Students and teachers:** profiles, class assignments, subject allocations
- **Academics:** academic years, classes and sections, subjects, weekly timetable
- **Attendance:** daily class attendance for students, attendance tracking for teachers, low-attendance alerts
- **Exams and results:** exam scheduling, marks entry, grades, report cards (PDF), CSV export
- **Fees:** fee structures and heads, payment recording, receipts (PDF), defaulter reports
- **Notices and notifications:** campus-wide or class-specific notices, in-app notifications, email
- **Administration:** user management, role-based access, audit log

## Roles

| Role | Purpose |
|---|---|
| Principal | Administers the institution: users, classes, fees, exams, admissions |
| Teacher | Marks attendance, enters marks for allocated classes and subjects, posts notices |
| Student | Views own timetable, attendance, results, fees, and notices |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Query, Axios |
| Backend | ASP.NET Core (.NET 8), Entity Framework Core, JWT authentication |
| Database | PostgreSQL (Supabase) |
| Email | Brevo (transactional API) |
| Hosting | Vercel (frontend), Render (backend), Supabase (database) |

## Project structure

```
institution-erp/
├── backend/
│   ├── src/
│   │   ├── InstitutionErp.Api/             # Controllers, middleware, startup
│   │   ├── InstitutionErp.Application/     # DTOs, interfaces, validators
│   │   ├── InstitutionErp.Domain/          # Entities and enums
│   │   └── InstitutionErp.Infrastructure/  # Database, auth, email, storage, PDF
│   └── tests/                              # Unit and integration tests
├── frontend/                               # React application
├── docs/                                   # ER diagram and notes
└── docker-compose.yml                      # Local development stack
```

## Getting started (local development)

### Prerequisites

- .NET 8 SDK
- Node.js 20+
- PostgreSQL 16+ (or Docker)

### 1. Configure environment

Copy `.env.example` to `.env` and fill in your own values. Never commit real secrets.

### 2. Run the backend

```bash
cd backend
dotnet restore
dotnet run --project src/InstitutionErp.Api --urls http://localhost:5050
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and proxies `/api` requests to the backend.

### Run with Docker

```bash
docker compose up --build
```

## Configuration

Configuration is read from environment variables. Main settings:

| Variable | Description |
|---|---|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `Jwt__Secret` | Secret used to sign tokens (long, random, kept private) |
| `Jwt__Issuer` / `Jwt__Audience` | Token issuer and audience |
| `Admin__Email` / `Admin__Password` | Initial administrator account |
| `Email__Provider` | `Brevo` (or `Smtp` for local testing) |
| `Email__ApiKey` | Brevo API key |
| `Email__FromAddress` / `Email__FromName` | Verified sender address and display name |
| `Email__DailyLimit` | Maximum emails per day (Brevo free plan: 300) |

## Deployment

- **Database:** Supabase PostgreSQL
- **Backend:** Docker web service on Render, built from `backend/Dockerfile`, health check at `/health`
- **Frontend:** Vercel, with `/api/*` requests rewritten to the backend (`frontend/vercel.json`)
- **Email:** Brevo, with a verified sender or domain

Free hosting tiers may put the backend to sleep when idle, so the first request after a pause can be slow.

## Testing

```bash
# Backend
cd backend && dotnet test

# Frontend
cd frontend && npm run lint && npm run build
```

## Roadmap

- Complete the security and production-readiness review
- Database migrations and stricter access control tests
- Mobile layout improvements and interface polish
- Cloud file storage for uploaded documents
- Online fee payments

## License

Add your license here (for example MIT), or state that the code is private and all rights are reserved.
