# PROMPT FOR ANTIGRAVITY: Digital Educational Institution Management System (ERP)

You are a senior full-stack engineer. Build a complete, working, production-style **Institution Management System (School/College ERP)** from scratch, covering database, backend API, and frontend, all running locally with one command. Work autonomously through the phases below. After each phase, build, run, and verify it works before moving on. Do not leave stubs, TODOs, or fake data in place of real logic (except where a section explicitly says "stub behind an interface").

---

## 1. PROJECT SUMMARY

A web-based, role-based system that digitizes a college's core operations in one place: admissions, students, teachers, fees, attendance, examinations and results, notices and notifications, and an analytics dashboard, plus a parent/student portal.

**Goal:** reduce paperwork and manual errors, and give admins, teachers, accountants, students and parents secure, role-appropriate access to the same centralized data.

---

## 2. TECH STACK (fixed, do not substitute)

| Layer | Technology |
|---|---|
| Backend | **ASP.NET Core 8 Web API** (C#), Controllers or Minimal APIs organised by feature |
| ORM | **Entity Framework Core 8** with **Npgsql** provider, code-first migrations |
| Database | **PostgreSQL 16** |
| Auth | **JWT access tokens + refresh tokens**, password hashing with **BCrypt.Net-Next**, role-based and policy-based authorization |
| Validation | FluentValidation |
| Mapping | Mapster or AutoMapper (pick one) |
| Logging | Serilog (console + rolling file) |
| API docs | Swagger / OpenAPI (Swashbuckle) with JWT "Authorize" button |
| PDF | QuestPDF (fee receipts, report cards) |
| Frontend | **React 18 + TypeScript + Vite**, **Tailwind CSS**, React Router, TanStack Query, React Hook Form + Zod, Axios, **Chart.js** (react-chartjs-2) |
| Parent portal | Same React app (role-based routes), fully responsive, installable as a PWA |
| Testing | xUnit + FluentAssertions + Testcontainers (or EF InMemory/SQLite where Postgres is impractical) for backend; Vitest + React Testing Library for key frontend pieces |
| DevOps | Docker + docker-compose (postgres, api, web), `.env.example`, GitHub Actions CI (build + test) |

---

## 3. REPOSITORY STRUCTURE

```
institution-erp/
├── README.md
├── docker-compose.yml
├── .env.example
├── .github/workflows/ci.yml
├── backend/
│   ├── InstitutionErp.sln
│   ├── src/
│   │   ├── InstitutionErp.Api/            (controllers, middleware, Program.cs, Swagger)
│   │   ├── InstitutionErp.Application/    (DTOs, services, validators, interfaces)
│   │   ├── InstitutionErp.Domain/         (entities, enums, domain rules)
│   │   └── InstitutionErp.Infrastructure/ (EF Core DbContext, migrations, repositories, PDF, notification providers, seeding)
│   └── tests/
│       ├── InstitutionErp.UnitTests/
│       └── InstitutionErp.IntegrationTests/
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/ (api/, components/, features/, hooks/, layouts/, pages/, routes/, store/, types/)
```

Use Clean Architecture layering (Api → Application → Domain; Infrastructure implements Application interfaces). Use async/await everywhere, cancellation tokens, and dependency injection.

---

## 4. USER ROLES AND RBAC

| Role | Access |
|---|---|
| **SuperAdmin** (Principal) | Full access, all modules, reports, user management, audit logs |
| **Admin** | Students, teachers, admissions, classes, subjects, exams, notices (no role management) |
| **Accountant** | Fee module only (structures, payments, receipts, dues, collection reports) |
| **Teacher** | Only their own allocated classes/subjects: mark attendance, enter marks, view their timetable and students |
| **Student** | Read-only: own profile, attendance, fees, results, notices |
| **Parent** | Read-only: data of their own linked children only, with a child switcher |

Enforce RBAC on the **server** (policies, plus resource-level checks, e.g. a teacher can only touch classes allocated to them; a parent can only read their own children). The frontend hides UI by role, but never relies on that for security.

---

## 5. MODULES AND REQUIREMENTS

### 5.1 Authentication and User Management
- Login (email + password), JWT access token (15 min) + refresh token (7 days, rotated, stored hashed in DB), logout/revoke, change password, forgot/reset password (token-based; email sending via the notification interface).
- Account lockout after 5 failed attempts (15 min).
- SuperAdmin can create/disable users and assign roles.
- Seed a default SuperAdmin from environment variables on first run.

### 5.2 Admission Management
- Public online application form (no login): applicant details, guardian details, desired class/course, previous-school marks, and **document upload** (PDF/JPG/PNG, max 5 MB each, validated by type and size, stored on local disk behind an `IFileStorage` interface).
- Admission status workflow: `Submitted → UnderReview → Approved / Rejected / Waitlisted`, with remarks and a history log of each transition.
- On **approval**: auto-create the Student record, generate a unique **student ID** (format `YYYY-CLS-0001`), create a Student user account and a Parent account (linked), and send credentials via the notification interface.
- Admin list with filters, search, pagination, export to CSV.

### 5.3 Student Management
- Full CRUD, soft delete, search, filter by class/section/status, pagination, CSV export.
- Profile: personal info, class/section, roll number, guardian links, photo, status (Active, Alumni, Suspended).
- A student belongs to one class. A parent can have many students.

### 5.4 Teacher Management
- Full CRUD, profile, qualifications, joining date.
- **Class and subject allocation** (teacher ↔ class ↔ subject), with a conflict check (no double allocation of the same slot).
- **Timetable** management: weekly periods per class with teacher/subject, with clash detection (teacher or class double-booked).
- **Teacher attendance**: marked by Admin, with monthly summary.

### 5.5 Attendance
- Teacher marks daily attendance for their class (Present / Absent / Late / Leave), bulk "mark all present" with exceptions, editable the same day only (Admin can override with an audit entry).
- Attendance percentage per student (monthly, term, overall), class-wise reports, low-attendance flag (< 75%, configurable).
- When a student is marked Absent, **automatically create a notification** to the linked parent(s): "Your child {name} was absent on {date}".
- Prevent duplicate attendance for the same student and date.

### 5.6 Examinations and Results
- Create exams (name, type, class, subjects, max marks, pass marks, date).
- Teachers enter marks for their own subjects only; validation (0 ≤ marks ≤ max). Admin can lock/publish results per exam.
- **Auto-calculate**: total, percentage, grade (configurable grade scale table), pass/fail, class rank.
- **Report card PDF** per student per exam/term (QuestPDF) including attendance summary.
- Students/parents see results only after they are published.

### 5.7 Fee Management
- Fee structures per class/academic year with multiple fee heads (tuition, transport, lab, etc.) and installment schedules with due dates.
- Auto-assign fees to students on admission/class change.
- Accountant records payments (cash, cheque, UPI, card, bank transfer) with partial payments supported; each payment generates a unique receipt number and a **PDF receipt**.
- Dues and overdue tracking, late-fee rule (configurable per day/percent), reminder notifications for upcoming/overdue fees.
- Reports: daily/monthly collection, pending dues by class, defaulters list, export to CSV.
- **Online payment:** implement an `IPaymentGateway` interface with a **Razorpay test-mode** implementation (create order, verify signature webhook) behind a feature flag, OFF by default. The offline flow must be fully functional without it.

### 5.8 Notices and Notifications
- Notices: Admin posts announcements (title, body, audience: All / a role / a class, expiry date, optional attachment). Users see only notices for their audience.
- In-app notification center (bell icon, unread count, mark as read).
- Define `INotificationChannel` with implementations: **InApp** (real), **Email** (real via SMTP/MailKit, configurable; use MailHog in docker-compose for dev), **SMS** and **WhatsApp** (**stub implementations that log the message**, clearly marked as pluggable for MSG91/Twilio/WhatsApp Cloud API). A background service (hosted service with a DB-backed outbox table) delivers notifications with retry.

### 5.9 Dashboard and Analytics
Role-aware dashboards using Chart.js:
- **Admin/Principal:** total students, teachers, classes; today's attendance %; monthly fee collected vs pending; attendance trend (last 30 days, line chart); fee collection by month (bar chart); class-wise strength (doughnut); recent admissions; low-attendance students.
- **Accountant:** collection today/this month, dues by class, recent payments.
- **Teacher:** today's classes, attendance to mark, pending marks entry.
- **Parent/Student:** child summary cards: attendance %, fees due, latest result, recent notices.

### 5.10 Audit and Security Features
- Audit log table (who, what, entity, old/new values as JSON, timestamp, IP) written automatically for create/update/delete on key entities and login events. SuperAdmin-only viewer with filters.
- Global exception-handling middleware returning RFC 7807 `ProblemDetails`.
- Rate limiting on login and public admission endpoints, CORS locked to configured origins, security headers, HTTPS redirection, input validation everywhere, parameterized queries only (EF Core), no sensitive data in logs.

---

## 6. DATABASE DESIGN (PostgreSQL)

Use snake_case table/column names (via `EFCore.NamingConventions`), `uuid` primary keys (or `bigint identity` where simpler), `created_at`/`updated_at`/`is_deleted` on main entities, proper foreign keys, unique constraints and indexes.

**Core tables:**
`users`, `roles`, `user_roles`, `refresh_tokens`, `students`, `parents`, `student_parents` (many-to-many), `teachers`, `academic_years`, `classes` (with section), `subjects`, `class_subjects`, `teacher_allocations`, `timetable_entries`, `admissions`, `admission_documents`, `admission_status_history`, `fee_heads`, `fee_structures`, `fee_structure_items`, `student_fees` (assigned installments), `fee_payments`, `fee_receipts`, `attendance` (student_id, class_id, date, status, marked_by; **unique(student_id, date)**), `teacher_attendance`, `exams`, `exam_subjects`, `marks`, `grade_scales`, `notices`, `notifications` (+ outbox/delivery status), `audit_logs`, `app_settings`.

**Key relationships:**
- A student belongs to exactly one class; a class has many students.
- A parent can have many students; a student can have multiple guardians.
- Attendance and marks reference both student and class (and marks reference exam + subject).
- Fee payments reference a student_fee installment; receipts reference payments 1:1.
- Teachers connect to classes/subjects via `teacher_allocations`.

Produce EF Core **migrations**, an ER diagram in `docs/er-diagram.md` (Mermaid), and a **seed** routine (dev only) that creates: 1 SuperAdmin, 1 Admin, 1 Accountant, 5 teachers, 6 classes, 8 subjects, 60 students, parents, a fee structure, 30 days of attendance, one exam with marks, and a few notices, so every dashboard shows meaningful data on first launch.

---

## 7. API DESIGN

RESTful JSON under `/api/v1`, plural nouns, pagination (`page`, `pageSize`, `search`, `sort`) with a standard paged-response envelope, consistent `ProblemDetails` errors, and full Swagger annotations/examples. Include at minimum:

- `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password`
- `/users` (SuperAdmin), `/students`, `/parents`, `/teachers`, `/classes`, `/subjects`, `/academic-years`
- `/teachers/{id}/allocations`, `/timetable`
- `/admissions` (public `POST /admissions/apply`, admin review/approve/reject endpoints, document upload/download)
- `/attendance` (mark, get by class/date, student summary, reports), `/teacher-attendance`
- `/exams`, `/exams/{id}/marks` (bulk entry), `/exams/{id}/publish`, `/results/student/{id}`, `/results/{examId}/report-card/{studentId}` (PDF)
- `/fee-structures`, `/fees/student/{id}`, `/fees/payments`, `/fees/payments/{id}/receipt` (PDF), `/fees/dues`, `/fees/reports/*`
- `/notices`, `/notifications` (list, unread count, mark read)
- `/dashboard/admin`, `/dashboard/accountant`, `/dashboard/teacher`, `/dashboard/parent`
- `/audit-logs`, `/health`

---

## 8. FRONTEND REQUIREMENTS

- Clean, modern, professional UI (Tailwind), responsive down to mobile, light/dark mode, accessible (labels, keyboard navigation, ARIA where needed).
- Role-based layouts and sidebar navigation; protected routes; automatic token refresh with Axios interceptors; global error toasts; loading skeletons; empty states.
- Reusable DataTable (server-side pagination, sorting, search, filters), form components with Zod validation, confirm dialogs, file upload component with progress.
- Pages: Login, Forgot/Reset Password, Public Admission Form (+ status check by reference number), Dashboards (per role), Students, Teachers, Classes/Subjects, Timetable, Admissions (review queue), Attendance (mark + reports), Exams and Marks entry, Results/Report cards, Fees (structures, collect payment, dues, reports), Notices, Notifications, Users and Audit Logs (SuperAdmin), Profile/Settings.
- Parent portal: child switcher, read-only cards for attendance, fees (with downloadable receipts), results (downloadable report cards), notices. Add a PWA manifest and service worker.

---

## 9. NON-FUNCTIONAL REQUIREMENTS

- Clean, readable, consistently formatted code (EditorConfig, nullable reference types enabled, analyzers on, ESLint + Prettier on the frontend).
- Appropriate indexes; avoid N+1 queries (use projections, `AsNoTracking`, `Include` wisely).
- Configuration through `appsettings.json` + environment variables; no secrets committed.
- Idempotent migrations applied automatically in Development; documented manual step for Production.
- Minimum test coverage: unit tests for grade calculation, attendance percentage, fee due and late-fee logic, admission approval workflow, and RBAC/resource-level authorization; integration tests for auth and at least one flow per module.

---

## 10. DEVELOPMENT PHASES (execute in order, verify each before continuing)

1. **Foundation:** solution scaffolding, docker-compose (Postgres + MailHog), EF Core setup, Serilog, Swagger, health check, global error handling, CI skeleton. *Verify: API starts, migrates DB, Swagger loads.*
2. **Auth and RBAC:** users, roles, JWT + refresh tokens, lockout, policies, seeding. *Verify: login works, protected endpoints reject wrong roles.*
3. **Core entities:** academic years, classes, subjects, students, parents, teachers, allocations, timetable (CRUD + frontend pages).
4. **Admissions and Fees:** admission workflow with uploads and auto student creation; fee structures, assignment, payments, receipts (PDF), dues, reports.
5. **Attendance and Exams/Results:** attendance marking and reports with parent notifications; exams, marks, grading, ranks, publish, report card PDF.
6. **Notices, Notifications and Dashboards:** notice audience targeting, in-app notification center, outbox worker + channels, all role dashboards with charts.
7. **Parent/Student portal and PWA polish:** read-only portal flows, child switcher, responsive/PWA.
8. **Hardening:** audit logs, rate limiting, security headers, tests, seed data, performance pass.
9. **Docs and delivery:** README, `docs/` (architecture, ER diagram, API overview, RBAC matrix, setup, deployment), Postman collection or exported OpenAPI JSON, final end-to-end smoke test.

---

## 11. DELIVERABLES AND ACCEPTANCE CRITERIA

- `docker compose up` starts PostgreSQL, MailHog, the API and the web app; the app is usable at `http://localhost:3000` (web) and `http://localhost:5000/swagger` (API) with seeded demo accounts listed in the README.
- Every module in Section 5 works end-to-end from UI → API → database.
- RBAC is enforced server-side; a teacher cannot read or modify another teacher's classes, and a parent cannot see another family's data (covered by automated tests).
- Approving an admission creates the student, IDs, accounts and a notification; marking absence notifies the parent; recording a payment produces a downloadable PDF receipt; publishing results enables report card PDFs.
- All tests pass in CI, and the solution builds with zero warnings treated as errors for the backend.
- README includes setup (with and without Docker), environment variables, demo credentials, architecture overview, and a "Future Scope" section (real SMS/WhatsApp providers, live payment gateway, multi-tenancy, mobile app).

**Scope guidance:** if time is constrained, finish the vertical slice first (Auth + Students + Attendance + Fees + Results + Dashboard), then Admissions, Teachers/Timetable, Notices, and Parent portal polish. SMS/WhatsApp providers, live Razorpay and a native mobile app are stretch goals; keep them behind interfaces as specified above.

Begin with Phase 1. After each phase, summarize what was built, how it was verified, and any decisions made, then continue to the next phase without waiting for approval unless you hit a genuine blocker.
