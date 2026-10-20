# CampusCore (institution-erp) — Security & Architecture Findings Log

**Branch:** `prod-hardening`  
**Status:** Canonical Vulnerability Inventory (Updated post-Phase 1)

---

## 1. Burned Secrets Catalog (Rotate & Never Use in Production)

The following secrets were committed to source control and are cataloged as **burned**. In Phase 1, all hardcoded fallbacks and committed secrets were purged from application code and configuration files. They must be replaced with strong, cryptographically generated values via environment variables before production deployment.

| Secret Name | File Location | Line(s) | Committed Value Type | Status | Phase 1 Remediation |
|---|---|---|---|---|---|
| `Jwt:Secret` | `backend/src/InstitutionErp.Api/appsettings.json`<br>`InstitutionErp.Api/Program.cs`<br>`InstitutionErp.Infrastructure/Auth/JwtTokenService.cs` | Line 10<br>Line 55<br>Line 21 | Real-looking secret string (`SuperSecretEnterpriseKeyWithMinimumThirtyTwoCharactersLength123!`) | **BURNED (PURGED FROM CODE)** | Purged from `appsettings.json`, `Program.cs`, and `JwtTokenService.cs`. Bound to `JwtOptions` with `ValidateOnStart` enforcing 32+ bytes. |
| `ConnectionStrings:DefaultConnection` | `backend/src/InstitutionErp.Api/appsettings.json`<br>`InstitutionErp.Infrastructure/DependencyInjection.cs`<br>`docker-compose.yml`<br>`.env.example` | Line 2<br>Line 21<br>Line 12<br>Line 3 | Real-looking database credentials (`Host=localhost;Port=5432;Database=institution_erp;Username=postgres;Password=root;`) | **BURNED (PURGED FROM CODE)** | Purged from `appsettings.json` and `DependencyInjection.cs`. `docker-compose.yml` reads from `.env`. `ValidateOnStart` forbids default/localhost in Production. |
| `Admin:Password` | `backend/src/InstitutionErp.Api/appsettings.json`<br>`InstitutionErp.Infrastructure/Seeding/DatabaseSeeder.cs` | Line 21<br>Line 65 | Hardcoded seed credential (`admin@123`) | **BURNED (PURGED FROM CODE)** | Purged from `appsettings.json` and `DatabaseSeeder.cs`. Password overwrite on startup disabled. `ValidateOnStart` enforces >= 14 chars and forbids `admin@123`. |
| `Payment:Razorpay:KeySecret` | `InstitutionErp.Infrastructure/Payment/RazorpayPaymentGateway.cs` | Line 15 | Hardcoded test secret (`DummySecretForDev123`) | **BURNED (PURGED FROM CODE)** | Purged from `RazorpayPaymentGateway.cs`. Gateway is fail-closed (returns `false` / throws `NotSupportedException` when disabled). Constant-time signature comparison active. |

---

## 2. Exhaustive Findings Inventory by Severity

### Critical Severity

| ID | Title | File Path & Lines | Description | Impact | Status | Proposed Fix (Phase) |
|---|---|---|---|---|---|---|
| **SEC-01** | **Admin Password Overwrite on Every Restart** | `backend/src/InstitutionErp.Infrastructure/Seeding/DatabaseSeeder.cs` | When an admin user already exists, the seeder previously re-hashed and overwrote their password hash with `Admin:Password` from configuration every time the app booted. | An attacker or restart resets the administrator's password to the default committed credential, wiping administrator password changes. | **RESOLVED (Phase 1)** | Only seed admin if no user with `Principal` role exists; never overwrite existing admin records. |
| **SEC-02** | **Plaintext Password Storage & Exfiltration** | `InstitutionErp.Domain/Entities/User.cs`<br>`StudentControllers.cs`<br>`TeacherControllers.cs` | Passwords stored in plaintext in `users.default_password`. Serialized and leaked over `/api/v1/students` and `/api/v1/teachers` in `StudentDto.GeneratedPassword` and `TeacherDto.GeneratedPassword`. | Total compromise of student and faculty accounts; anyone with read access can view all accounts in plaintext. | **RESOLVED (Phase 2)** | Dropped `users.default_password` column & entity property; removed `GeneratedPassword` from all GET DTOs; generate CSPRNG 14-char password returned once to Principal only via `CredentialSlipDto`. |
| **SEC-03** | **Formula Passwords & Multiple Auth Fallbacks** | `backend/src/InstitutionErp.Api/Controllers/AuthController.cs`<br>`PasswordGenerator.cs` | Login method verifies BCrypt hash, but if that fails, checks plaintext `DefaultPassword`, then case-insensitive match, then formula `Welcome@{regNo}` and `Teach@{phone}`. | Bypasses password hashing entirely; attackers can calculate passwords using public student registration numbers or teacher phone numbers. | **RESOLVED (Phase 2)** | Removed all fallback comparisons; enforce strict BCrypt work factor 12+ verification only; removed formula password methods. |
| **SEC-04** | **Unauthenticated Health Endpoint Information Leak** | `backend/src/InstitutionErp.Api/Controllers/SystemControllers.cs` | `GET api/v1/health` had NO `[Authorize]` attribute and directly queried `Users.CountAsync()`, returning database connection details. | Unauthenticated external parties can probe database connectivity and user count metrics. | **RESOLVED (Phase 2)** | Deleted custom HealthController; mapped ASP.NET Core Health Checks to `/health` and `/api/v1/health` with zero sensitive detail leak. |
| **SEC-05** | **Missing Role Authorization on Teacher Deallocation** | `backend/src/InstitutionErp.Api/Controllers/TeacherControllers.cs` | `DELETE api/v1/teachers/allocations/{allocationId}` had a bare `[Authorize]` attribute with NO role constraints. | Any authenticated user (including students) could delete faculty class allocations. | **RESOLVED (Phase 2)** | Enforced `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` on all allocation management endpoints. |

---

### High Severity

| ID | Title | File Path & Lines | Description | Impact | Status | Proposed Fix (Phase) |
|---|---|---|---|---|---|---|
| **SEC-06** | **Fail-Open Student Directory Scoping** | `backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs` | `GetStudents` endpoint checked `if (User.IsInRole("Teacher"))`, but had no `else` condition rejecting `Student`. | Any student could query `GET /api/v1/students` and dump the complete school directory including student contact info. | **RESOLVED (Phase 2)** | Reject students with HTTP 403 Forbidden on directory list; detail endpoint restricts students strictly to self. |
| **SEC-07** | **Fail-Open Class Attendance Scoping** | `backend/src/InstitutionErp.Api/Controllers/AttendanceController.cs` | `GetClassAttendance` checked `if (User.IsInRole("Teacher"))`, but did not restrict students. | Enrolled students could inspect full attendance registers and absence records of all peers. | **RESOLVED (Phase 2)** | Restrict class attendance sheets to Principal and allocated Teachers; reject students with HTTP 403. |
| **SEC-08** | **Fail-Open Student Fee Ledger Scoping** | `backend/src/InstitutionErp.Api/Controllers/FeeControllers.cs` | `GetStudentFees` checked `if (User.IsInRole("Student"))` to verify student ID matches claim, but had no restriction on `Teacher`. | Any teacher could view private fee structures, balances, and payment records of any student. | **RESOLVED (Phase 2)** | Restrict fee ledgers and receipts strictly to Principal, Admin, and self-student/parent. |
| **SEC-09** | **Dormant Validation Layer** | `backend/src/InstitutionErp.Application/Validators/AppValidators.cs` | FluentValidation validators were previously registered in DI but never hooked into ASP.NET Core MVC pipeline. | Unvalidated, malformed, or malicious DTO inputs reached database queries and entities. | **RESOLVED (Phase 4)** | Global `ValidationFilterAttribute` auto-discovers `IValidator<T>` and returns standard RFC 7807 400 ValidationProblemDetails with traceId. |
| **SEC-10** | **Unauthenticated / Insecure Admission Document Upload** | `backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs` | Documents uploaded by admission ID without verification of application secret or MIME magic bytes. | Unrestricted file upload vulnerability; attackers could upload malicious binaries or overwrite documents. | Open | Enforce per-application secret, validate `%PDF-` magic bytes, enforce 5 MB limit. (Phase 2, Phase 4) |
| **SEC-11** | **Client-Side Route Guard Bypass** | `frontend/src/routes/AppRoutes.tsx` | `StaffOnly` guard previously checked only `if (hasRole('Student')) return Navigate`, allowing teachers direct navigation to admin and fee management views. | Teachers could navigate directly to `/admin/users`, `/admin/audit-logs`, and `/fees`. | **RESOLVED (Phase 6)** | Enforced strict `PrincipalOnly` (governance, fees, teachers, admissions, student directory) and `StaffOnly` (allocated staff operations) route guards with automatic fallback redirection. |
| **SEC-12** | **Broken TypeScript Build Blocker** | `frontend/src/pages/dashboards/ParentDashboardPage.tsx` (Lines 178, 180, 183) | Previously referenced `data?.classRoomId` on `ParentStudentDashboardData` DTO, which was missing on both backend DTO and frontend interface. | `npm run build` failed during CI compilation. | **RESOLVED** | Added `ClassRoomId` to backend `ParentStudentDashboardDto`, populated from `student.ClassRoomId`, and added to frontend `ParentStudentDashboardData` interface. |

---

### Medium Severity

| ID | Title | File Path & Lines | Description | Impact | Status | Proposed Fix (Phase) |
|---|---|---|---|---|---|---|
| **SEC-13** | **Silent Email Failure & Lost Deliveries** | `backend/src/InstitutionErp.Infrastructure/Notifications/EmailNotificationChannel.cs` | Catches SMTP/API exceptions, logs a warning, and previously returned `true`. | Failed emails were marked as `Sent` in `notification_outboxes`, permanently losing reset links and notifications. | **RESOLVED (Phase 4)** | Brevo HTTPS channel with 300 daily cap guard, fail-safe retries (returns `false` on failure to trigger exponential backoff retries), and MailHog SMTP dev fallback. |
| **SEC-14** | **Insecure Razorpay Signature Mock & Fallbacks** | `backend/src/InstitutionErp.Infrastructure/Payment/RazorpayPaymentGateway.cs` | Previously returned `true` unconditionally when `Payment:Razorpay:Enabled` was false, and contained fallback secret. | Mock verification allowed fake payment verification; fallback secret could be abused. | **RESOLVED (Phase 1)** | Gateways fail-closed (returns `false` when disabled or missing credentials); uses constant-time compare. |
| **SEC-15** | **Sequential In-Memory Number Generation Race Conditions** | `AdmissionsController.cs`<br>`StudentsController.cs`<br>`TeacherControllers.cs`<br>`FeeControllers.cs` | Numbers previously calculated via in-memory string-parsing and count loops. | Concurrent requests produce duplicate numbers causing collisions or crashes. | **RESOLVED (Phase 3)** | Atomic PostgreSQL sequences (`ISequenceGenerator`) with transactional boundary isolation and collision avoidance. |
| **SEC-16** | **Missing EF Core Migrations** | `backend/src/InstitutionErp.Api/Program.cs` | Previously used `EnsureCreatedAsync()` and ad-hoc runtime SQL `ALTER TABLE`. | Schema changes could not be reliably tracked, upgraded, or rolled back. | **RESOLVED (Phase 3)** | Generated baseline EF Core migration `InitialCreate`, replaced with `MigrateAsync()` under `AUTO_MIGRATE` gate, removed runtime `ALTER TABLE`. |
| **SEC-17** | **Insecure Browser Token Storage** | `frontend/src/store/authContext.tsx` (Lines 52-56) | Access tokens and refresh tokens stored in browser `localStorage`. | Vulnerable to token theft via Cross-Site Scripting (XSS). | Open | Move refresh token to HttpOnly, Secure, SameSite cookie; access token in memory. (Phase 6) |
| **SEC-18** | **Vulnerable Dependencies** | `backend/src/InstitutionErp.Infrastructure.csproj`<br>`frontend/package.json` | Moderate vulnerabilities in `MailKit`/`MimeKit` 4.7.1; High vulnerabilities in `braces`, `postcss-selector-parser`, `chokidar`, `tailwindcss`. | Potential dependency exploits. | Partial (Backend Resolved in Phase 4) | Upgraded `MailKit`/`MimeKit` to 4.18.1 (0 vulnerabilities/warnings). Frontend audit fix targeted in Phase 6. |

---

### Low Severity

| ID | Title | File Path & Lines | Description | Impact | Status | Proposed Fix (Phase) |
|---|---|---|---|---|---|---|
| **SEC-19** | **Missing Database Query AsNoTracking** | Multiple controllers (`StudentControllers.cs`, `AcademicControllers.cs`) | Read-only queries executed without `.AsNoTracking()`. | Unnecessary memory overhead and EF tracking cache bloat. | Open | Add `.AsNoTracking()` to all GET queries. (Phase 3) |
| **SEC-20** | **Unbounded Table Scans & Missing Pagination** | `TeacherControllers.cs` (GetTeachers), `AcademicControllers.cs` (GetClasses) | Endpoints load entire tables into memory without `Skip`/`Take`. | Potential Denial of Service as institution data grows. | Open | Implement standard pagination parameters (`page`, `pageSize` capped at 100). (Phase 3) |
