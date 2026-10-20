# Security Reviewer Architecture & Technical Audit Report: CampusCore (institution-erp)

---

## 1. Project overview

### Purpose, User Roles, and Main Modules
**CampusCore** (`institution-erp`) is an educational Enterprise Resource Planning (ERP) platform developed for managing academic institutions, faculty workflows, student cohorts, admissions, grading, examinations, attendance, and tuition fees.

- **User Roles:**
  - `Principal` (Acts as the SuperAdmin/Institution Administrator with full operational governance across users, classes, finances, and system settings).
  - `Teacher` (Faculty member allocated to specific classes and subjects; records daily student attendance, logs teacher attendance, and grades student examination marks).
  - `Student` (Enrolled student; accesses personalized daily timetables, exam marks breakdown, published circulars/notices, attendance summaries, and tuition invoices).
  - *Note on `Parent`:* The domain enum `UserRoleType` defines only `Principal`, `Teacher`, and `Student`. References to `Parent` in code/queries are backward-compatibility checks or email matches against `GuardianEmail`.

- **Main Modules:**
  - **Admissions:** Public application portal (`ADM-YYYY-####`), document submission (PDF), admin review workflow, and automated student enrollment upon approval.
  - **Students:** Student directory, profile management, academic status, roll number tracking, and student password management.
  - **Teachers:** Faculty profiles, employee codes (`TCH-###`), subject specializations, qualifications, and classroom allocations.
  - **Academics & Timetable:** Academic years, classroom/section definition, subject catalog, weekly 8-period timetable scheduling, and academic schedule fixing.
  - **Attendance:** Daily period/daily classroom attendance marking for students (Present/Absent/Late/Leave), low-attendance detection (<75%), and teacher daily attendance tracking.
  - **Exams & Results:** Unit test/mid-term/final exam scheduling, per-subject grading entry, percentage/grade calculation, report card PDF generation, and CSV exports.
  - **Fees & Billing:** Fee structure item configuration (tuition, lab, exam fees), student billing ledgers, partial/full payment collection, and PDF receipt generation.
  - **Notices & Notifications:** Campus-wide and class-targeted noticeboard, in-app notification center, and asynchronous email dispatch queue.
  - **System Administration:** User management, role assignment, account lockout management, and comprehensive audit trail logging.

---

### Solution / Repo Structure (3 Levels Deep)

```
d:\CLG APP
├── .git/
├── .gitignore
├── antigravity_prompt_institution_erp.md
├── README.md
├── runall.bat
├── runall.ps1
└── institution-erp/
    ├── .env.example
    ├── docker-compose.yml
    ├── README.md
    ├── runall.bat
    ├── runall.ps1
    ├── backend/
    │   ├── Dockerfile
    │   ├── InstitutionErp.sln
    │   ├── InstitutionErp.slnx
    │   ├── src/
    │   │   ├── InstitutionErp.Api/
    │   │   ├── InstitutionErp.Application/
    │   │   ├── InstitutionErp.Domain/
    │   │   └── InstitutionErp.Infrastructure/
    │   └── tests/
    │       ├── InstitutionErp.IntegrationTests/
    │       └── InstitutionErp.UnitTests/
    ├── docs/
    │   └── er-diagram.md
    └── frontend/
        ├── Dockerfile
        ├── index.html
        ├── nginx.conf
        ├── package.json
        ├── postcss.config.js
        ├── tailwind.config.js
        ├── tsconfig.app.json
        ├── tsconfig.json
        ├── tsconfig.node.json
        ├── vite.config.ts
        └── src/
            ├── App.css
            ├── App.tsx
            ├── index.css
            ├── main.tsx
            ├── api/
            ├── assets/
            ├── components/
            ├── layouts/
            ├── pages/
            ├── routes/
            ├── store/
            ├── types/
            └── utils/
```

---

### .NET Target Framework and NuGet Packages

All backend projects target **`.NET 8.0`** (`net8.0`).

| Package Name | Version | Project(s) | Category / Purpose |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore` | `8.0.8` | Application, Infrastructure | Object-Relational Mapping (ORM) |
| `Microsoft.EntityFrameworkCore.Relational` | `8.0.8` | Infrastructure | Relational DB Core abstractions |
| `Microsoft.EntityFrameworkCore.Design` | `8.0.8` | Infrastructure, Api | EF Core CLI tooling |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | `8.0.4` | Infrastructure | PostgreSQL Database Provider |
| `EFCore.NamingConventions` | `8.0.3` | Infrastructure | Snake-case table/column naming |
| `BCrypt.Net-Next` | `4.0.3` | Infrastructure | Password Hashing (Enhanced BCrypt) |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | `8.0.8` | Api | JWT Authentication Handler |
| `Microsoft.IdentityModel.Tokens` | `8.0.1` | Infrastructure | Token validation & signing primitives |
| `System.IdentityModel.Tokens.Jwt` | `8.0.1` | Infrastructure | JWT creation and parsing |
| `Serilog.AspNetCore` | `8.0.1` | Api | Structured application logging |
| `Serilog.Sinks.Console` | `5.0.1` | Api | Console log target |
| `Serilog.Sinks.File` | `5.0.0` | Api | Rolling file log target (`logs/erp-.log`) |
| `FluentValidation` | `11.9.0` | Application | Input validation rules |
| `FluentValidation.DependencyInjectionExtensions` | `11.9.0` | Application | Service container registration |
| `Mapster` | `7.4.0` | Application | Object-to-object mapping |
| `QuestPDF` | `2024.3.0` | Infrastructure | PDF report card & receipt generation |
| `MailKit` | `4.7.1` | Infrastructure | SMTP email dispatch client |
| `MimeKit` | `4.7.1` | Infrastructure | MIME email message construction |
| `Swashbuckle.AspNetCore` | `6.6.2` | Api | OpenAPI / Swagger UI documentation |
| `AspNetCore.HealthChecks.NpgSql` | `8.0.1` | Api | PostgreSQL health check probe |
| `xunit` | `2.8.0` | UnitTests, IntegrationTests | Unit test execution runner |
| `FluentAssertions` | `6.12.0` | UnitTests, IntegrationTests | Assertion assertions |
| `Moq` | `4.20.70` | UnitTests | Test mocking library |
| `Microsoft.AspNetCore.Mvc.Testing` | `8.0.8` | IntegrationTests | Integration test web host |
| `MediatR` | **NOT FOUND** | None | *Not installed or used anywhere in solution* |
| `AutoMapper` | **NOT FOUND** | None | *Not installed (Mapster is used instead)* |

---

### Frontend Stack Details

- **Framework & Version:** React `19.2.8` (`react`, `react-dom`)
- **Build Tool:** Vite `8.3.0` (`@vitejs/plugin-react` `6.1.1`)
- **Language:** TypeScript `~6.0.2`
- **UI & Styling Library:** Tailwind CSS `3.4.19`, PostCSS `8.5.29`, Autoprefixer `10.6.1`, `clsx` `2.1.1`, `tailwind-merge` `3.7.0`, `lucide-react` `1.55.0`
- **State Management:** React Context API (`AuthContext`), TanStack React Query `5.104.2` (`@tanstack/react-query`)
- **Routing Library:** React Router DOM `7.18.4` (`react-router-dom`)
- **HTTP Client:** Axios `1.20.0`
- **Charting:** Chart.js `4.5.1`, `react-chartjs-2` `5.3.1`
- **Package Manager:** npm
- **All Scripts in `package.json`:**
  - `"dev"`: `"vite"`
  - `"build"`: `"tsc -b && vite build"`
  - `"lint"`: `"oxlint"`
  - `"preview"`: `"vite preview"`

---

### Tests (Backend & Frontend)

- **Backend Test Projects:**
  1. `InstitutionErp.UnitTests` ([InstitutionErp.UnitTests.csproj](file:///d:/CLG%20APP/institution-erp/backend/tests/InstitutionErp.UnitTests/InstitutionErp.UnitTests.csproj)):
     - Framework: xUnit 2.8.0, FluentAssertions 6.12.0, Moq 4.20.70.
     - Test File: [BusinessLogicTests.cs](file:///d:/CLG%20APP/institution-erp/backend/tests/InstitutionErp.UnitTests/BusinessLogicTests.cs) (159 lines). Covers: Grade scale percentage calculations, attendance low-percentage thresholding, fee balance calculations, admission state machine transitions, and `PasswordGenerator` formatting.
  2. `InstitutionErp.IntegrationTests` ([InstitutionErp.IntegrationTests.csproj](file:///d:/CLG%20APP/institution-erp/backend/tests/InstitutionErp.IntegrationTests/InstitutionErp.IntegrationTests.csproj)):
     - Configured with `Microsoft.AspNetCore.Mvc.Testing` 8.0.8, xUnit 2.8.0, InMemory EF Core.
     - Test Files: **NOT FOUND**. The project contains 0 `.cs` test classes.
- **Frontend Tests:**
  - Test Projects / Files / Frameworks: **NOT FOUND** (No Vitest, Jest, Cypress, or Playwright installed; 0 frontend test files exist).

---

### Git Repository State

- **Git Repo:** Yes, active Git repository rooted at `d:\CLG APP`.
- **Branches:**
  - `* main` (tracked with `origin/main`)
  - `remotes/origin/HEAD -> origin/main`
  - `remotes/origin/YUGA`
  - `remotes/origin/main`
- **`.gitignore` File:** Present at `d:\CLG APP\.gitignore` (49 lines).
- **Committed Files Audit:**
  - `appsettings.json` with secrets: **COMMITTED** ([appsettings.json](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/appsettings.json)).
  - `appsettings.Development.json`: **COMMITTED** ([appsettings.Development.json](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/appsettings.Development.json)).
  - `.env.example`: **COMMITTED** ([.env.example](file:///d:/CLG%20APP/institution-erp/.env.example)).
  - Actual `.env` / `.env.local` files: **NOT COMMITTED** (none exist on disk).
  - `bin/`, `obj/`, `node_modules/`: **NOT COMMITTED** (properly ignored by git).
  - Uploaded files (`uploads/`): **NOT COMMITTED** (local only).
  - Database dumps (`.sql`, `.dump`): **NOT COMMITTED** (0 database dump files exist).

---

## 2. Backend architecture

### Architecture Layers

The backend follows an Onion / Clean Architecture structure partitioned across 4 projects:

1. **`InstitutionErp.Domain`** ([InstitutionErp.Domain.csproj](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Domain/InstitutionErp.Domain.csproj)):
   - Contains pure domain entities, domain enums, and base entities. Zero external NuGet dependencies.
   - Entities: `User`, `Role`, `UserRole`, `RefreshToken`, `AcademicYear`, `ClassRoom`, `Subject`, `ClassSubject`, `Teacher`, `TeacherAllocation`, `TimetableEntry`, `TeacherAttendance`, `Student`, `Attendance`, `Admission`, `AdmissionDocument`, `AdmissionStatusHistory`, `FeeHead`, `FeeStructure`, `FeeStructureItem`, `StudentFee`, `FeePayment`, `FeeReceipt`, `Exam`, `ExamSubject`, `ExamMark`, `GradeScale`, `Notice`, `Notification`, `NotificationOutbox`, `AuditLog`, `AppSetting`.
   - Base Class: `BaseEntity` (provides `Id = Guid.NewGuid()`, `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`, `IsDeleted = false`).
2. **`InstitutionErp.Application`** ([InstitutionErp.Application.csproj](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Application/InstitutionErp.Application.csproj)):
   - Contains DTOs (`DTOs/`), Common Interfaces (`IApplicationDbContext`, `ICurrentUserService`, `IPasswordHasher`, `IJwtTokenService`, `IFileStorage`, `IPdfService`, `IPaymentGateway`, `INotificationSender`, `IAuditLogService`), Utility helpers (`PasswordGenerator`), and FluentValidation validators (`AppValidators.cs`).
3. **`InstitutionErp.Infrastructure`** ([InstitutionErp.Infrastructure.csproj](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/InstitutionErp.Infrastructure.csproj)):
   - Implements data access and external services.
   - Persistence: `ApplicationDbContext` with PostgreSQL Npgsql provider, SnakeCase naming conventions, and EF Core soft-delete query filters.
   - Auth: `PasswordHasher` (`BCrypt.Net-Next`), `JwtTokenService`.
   - Notifications: `NotificationSender`, `NotificationOutboxWorker` (hosted service), `EmailNotificationChannel` (MailKit), `SmsNotificationChannel` (stub), `WhatsAppNotificationChannel` (stub).
   - Storage & PDF: `FileStorageService` (local disk PDF storage), `QuestPdfService` (Report Card and Fee Receipt generation).
   - Payment: `RazorpayPaymentGateway` (custom HMAC signature verifier / simulation stub).
   - Seeding: `DatabaseSeeder`.
4. **`InstitutionErp.Api`** ([InstitutionErp.Api.csproj](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/InstitutionErp.Api.csproj)):
   - Web API presentation layer with 10 controller files, Middlewares (`ExceptionHandlingMiddleware`, `SecurityHeadersMiddleware`), and runtime wiring in `Program.cs`.

---

### Program.cs Registrations & Pipeline

- **Serilog:** Reads from `builder.Configuration`, writes to Console and rolling daily file `logs/erp-.log`.
- **Layers:** `builder.Services.AddApplication()` (registers FluentValidation validators), `builder.Services.AddInfrastructure(builder.Configuration)` (EF Core DbContext, auth services, storage, PDF, notifications, seeder).
- **Current User:** Injects `HttpContextAccessor` and `CurrentUserService` as `ICurrentUserService`.
- **JWT Authentication:** Configured via `AddJwtBearer` with HMAC-SHA256, validating issuer, audience, signing key, lifetime, and zero clock skew.
- **Authorization Policies:** `RequirePrincipal`, `RequireTeacher`, `RequireStudent`, `RequireSuperAdmin`, `RequireAdmin`, `RequireAccountant`, `RequireParentOrStudent`.
- **Rate Limiting:** Inbuilt ASP.NET Core `FixedWindowLimiter` named `"auth-limit"` (15 requests/minute, queue limit 2).
- **Controllers & Enums:** `AddControllers()` with `JsonStringEnumConverter`.
- **Health Checks:** `builder.Services.AddHealthChecks()` mapped to `/health`.
- **Swagger / OpenAPI:** Registered unconditionally with Bearer token scheme.
- **Startup Seeding:** In `Program.cs` lines 157–178, runs `EnsureCreatedAsync()`, executes raw SQL `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_password text NULL;`, and runs `DatabaseSeeder.SeedAsync()`.
- **Omitted / Missing in Program.cs:**
  - `app.UseHttpsRedirection()`: **NOT FOUND**
  - `app.UseHsts()`: **NOT FOUND**
  - Forwarded Headers Middleware (`UseForwardedHeaders`): **NOT FOUND**
  - Environment check on Swagger (`if (app.Environment.IsDevelopment())`): **NOT FOUND** (Swagger is exposed in Production).

#### Quoted CORS Configuration ([Program.cs:L78-93](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L78-L93))
```csharp
// 6. CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

#### Quoted Middleware Pipeline ([Program.cs:L180-203](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L180-L203))
```csharp
// 11. Middleware Pipeline
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseSerilogRequestLogging();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Institution ERP API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("CorsPolicy");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
```

---

### Complete Controllers & Endpoints Inventory

Below is the exhaustive inventory of all 22 controller classes and 59 endpoints across the 10 controller files.

#### 1. `AcademicControllers.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AcademicControllers.cs))
- Base Route: `api/v1/academic-years`, `api/v1/classes`, `api/v1/subjects`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly into all 3 classes).

| Class | HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|---|
| `AcademicYearsController` | `GET` | `api/v1/academic-years` | `[Authorize]` | None | `List<AcademicYearDto>` | Retrieves all academic years |
| `AcademicYearsController` | `POST` | `api/v1/academic-years` | `[Authorize(Roles = "Principal")]` | `CreateAcademicYearRequest` | `AcademicYearDto` | Creates a new academic year |
| `AcademicYearsController` | `PUT` | `api/v1/academic-years/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `UpdateAcademicYearRequest` | `AcademicYearDto` | Updates an academic year |
| `AcademicYearsController` | `DELETE` | `api/v1/academic-years/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Soft-deletes an academic year |
| `ClassesController` | `GET` | `api/v1/classes` | `[Authorize]` | None | `List<ClassRoomDto>` | Retrieves all classrooms/sections |
| `ClassesController` | `GET` | `api/v1/classes/{id}` | `[Authorize]` | None | `ClassRoomDto` | Retrieves single classroom by ID |
| `ClassesController` | `POST` | `api/v1/classes` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateClassRoomRequest` | `ClassRoomDto` | Creates a new classroom |
| `ClassesController` | `PUT` | `api/v1/classes/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `UpdateClassRoomRequest` | `ClassRoomDto` | Updates a classroom |
| `ClassesController` | `DELETE` | `api/v1/classes/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Soft-deletes a classroom |
| `ClassesController` | `GET` | `api/v1/classes/{id}/subjects` | `[Authorize]` | None | `List<SubjectDto>` | Retrieves subjects assigned to class |
| `ClassesController` | `POST` | `api/v1/classes/{id}/class-teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `AssignClassTeacherRequest` | `IActionResult` | Designates class teacher |
| `ClassesController` | `DELETE` | `api/v1/classes/{id}/class-teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Removes class teacher designation |
| `ClassesController` | `POST` | `api/v1/classes/{id}/subjects` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `AssignSubjectToClassRequest` | `IActionResult` | Assigns subject to classroom |
| `ClassesController` | `POST` | `api/v1/classes/{id}/subjects/{subjectId}/teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `AssignClassSubjectTeacherRequest` | `IActionResult` | Allocates teacher to subject in class |
| `ClassesController` | `DELETE` | `api/v1/classes/{id}/subjects/{subjectId}/teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Removes allocated teacher from subject |
| `ClassesController` | `DELETE` | `api/v1/classes/{id}/subjects/{subjectId}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Removes subject from class |
| `ClassesController` | `GET` | `api/v1/classes/{id}/students` | `[Authorize]` | None | `List<StudentDto>` | Retrieves students enrolled in class |
| `SubjectsController` | `GET` | `api/v1/subjects` | `[Authorize]` | None | `List<SubjectDto>` | Retrieves all subjects |
| `SubjectsController` | `POST` | `api/v1/subjects` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateSubjectRequest` | `SubjectDto` | Creates a new subject |
| `SubjectsController` | `GET` | `api/v1/subjects/{id}` | `[Authorize]` | None | `SubjectDto` | Retrieves subject by ID |
| `SubjectsController` | `GET` | `api/v1/subjects/{id}/teachers` | `[Authorize]` | None | `List<SubjectTeacherDto>` | Retrieves teachers teaching subject |
| `SubjectsController` | `POST` | `api/v1/subjects/{id}/teachers` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `AssociateSubjectTeacherRequest` | `IActionResult` | Associates teacher with subject |
| `SubjectsController` | `PUT` | `api/v1/subjects/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `UpdateSubjectRequest` | `SubjectDto` | Updates subject details |
| `SubjectsController` | `DELETE` | `api/v1/subjects/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Soft-deletes a subject |

#### 2. `AdmissionsController.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs))
- Base Route: `api/v1/admissions`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly).
- **SECURITY FLAG:** The controller class has **NO** class-level `[Authorize]` attribute.

| HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|
| `POST` | `api/v1/admissions/apply` | `[AllowAnonymous]` | `ApplyAdmissionRequest` | `AdmissionDto` | Public online student application |
| `GET` | `api/v1/admissions/status/{referenceNumber}` | `[AllowAnonymous]` | None | `AdmissionDto` | Public application status check |
| `POST` | `api/v1/admissions/{id}/documents` | `[AllowAnonymous]` | `AdmissionDocumentUploadRequest` (multipart) | `IActionResult` | Public applicant document upload |
| `GET` | `api/v1/admissions` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | Query params (page, size, search, status, classId) | `PagedResult<AdmissionDto>` | Lists admission applications |
| `GET` | `api/v1/admissions/documents/{id}/download` | `[Authorize]` *(No role specified!)* | None | `FileStreamResult` (PDF) | Downloads uploaded applicant document |
| `GET` | `api/v1/admissions/export` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | Query params (status, classId) | `FileContentResult` (CSV) | Exports admission applications to CSV |
| `PUT` | `api/v1/admissions/{id}/status` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `UpdateAdmissionStatusRequest` | Object with `generatedPassword` | Approves/rejects admission & enrolls student |
| `DELETE` | `api/v1/admissions/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Soft-deletes an admission record |

#### 3. `AttendanceController.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AttendanceController.cs))
- Base Route: `api/v1/attendance`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly).

| HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|
| `POST` | `api/v1/attendance/mark` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | `BulkMarkAttendanceRequest` | Object | Marks attendance for class & dispatches absent alerts |
| `GET` | `api/v1/attendance/class/{classId}` | `[Authorize]` *(Method has NO role attr)* | Query `date` | `ClassAttendanceSummaryDto` | Returns daily attendance sheet for class |
| `GET` | `api/v1/attendance/student/{studentId}/summary` | `[Authorize]` *(Method has NO role attr)* | None | `StudentAttendanceSummaryDto` | Returns student attendance metrics |
| `GET` | `api/v1/attendance/low-attendance` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | Query `classId` | `List<StudentAttendanceSummaryDto>` | Identifies students with <75% attendance |

#### 4. `AuthController.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs))
- Base Route: `api/v1/auth`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly).

| HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|
| `POST` | `api/v1/auth/login` | `[AllowAnonymous]` | `LoginRequest` | `LoginResponse` | Authenticates user (email/student ID/employee code) |
| `POST` | `api/v1/auth/refresh` | `[AllowAnonymous]` | `RefreshTokenRequest` | `LoginResponse` | Validates refresh token & rotates new token pair |
| `POST` | `api/v1/auth/logout` | `[Authorize]` | None | Object | Revokes all active refresh tokens for user |
| `POST` | `api/v1/auth/change-password` | `[Authorize]` | `ChangePasswordRequest` | Object | Changes authenticated user's password |
| `POST` | `api/v1/auth/forgot-password` | `[AllowAnonymous]` | `ForgotPasswordRequest` | Object | Generates 6-digit reset code & queues email |
| `POST` | `api/v1/auth/reset-password` | `[AllowAnonymous]` | `ResetPasswordRequest` | Object | Resets password with 6-digit verification code |
| `GET` | `api/v1/auth/me` | `[Authorize]` | None | `UserDto` | Returns current user profile & roles |

#### 5. `ExamControllers.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/ExamControllers.cs))
- Base Route: `api/v1/exams`, `api/v1/results`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly into both `ExamsController` and `ResultsController`).

| Class | HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|---|
| `ExamsController` | `GET` | `api/v1/exams` | `[Authorize]` | Query `classId` | `List<ExamDto>` | Lists exams (filtered by class/student/teacher) |
| `ExamsController` | `GET` | `api/v1/exams/{id}` | `[Authorize]` | None | `ExamDto` | Retrieves single exam details |
| `ExamsController` | `POST` | `api/v1/exams` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateExamRequest` | `ExamDto` | Schedules a new examination |
| `ExamsController` | `PUT` | `api/v1/exams/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateExamRequest` | `ExamDto` | Updates exam schedule and subjects |
| `ExamsController` | `DELETE` | `api/v1/exams/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Deletes an examination |
| `ExamsController` | `GET` | `api/v1/exams/{id}/marks/{examSubjectId}` | `[Authorize]` | None | `List<ExamMarkEntryDto>` | Gets student marks sheet for subject |
| `ExamsController` | `POST` | `api/v1/exams/{id}/marks` | `[Authorize]` | `SaveMarksRequest` | `IActionResult` | Faculty saves marks (enforces teacher allocation) |
| `ExamsController` | `POST` | `api/v1/exams/{id}/publish` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Locks marks and publishes exam to students |
| `ResultsController` | `GET` | `api/v1/results/me` | `[Authorize]` | None | `List<StudentExamResultDto>` | Gets authenticated student's published results |
| `ResultsController` | `GET` | `api/v1/results/student/{studentId}` | `[Authorize]` | None | `List<StudentExamResultDto>` | Gets student results (scoped by student/teacher) |
| `ResultsController` | `GET` | `api/v1/results/{examId}/report-card/{studentId}` | `[Authorize]` | None | `FileContentResult` (PDF) | Generates QuestPDF branded report card |
| `ResultsController` | `GET` | `api/v1/results/exam/{examId}/class-report` | `[Authorize(Roles = "Principal,Teacher")]` | None | `ClassExamReportDto` | Aggregated class performance & ranks |
| `ResultsController` | `GET` | `api/v1/results/exam/{examId}/export-csv` | `[Authorize(Roles = "Principal,Teacher")]` | None | `FileContentResult` (CSV) | Exports class exam score matrix to CSV |

#### 6. `FeeControllers.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/FeeControllers.cs))
- Base Route: `api/v1/fee-structures`, `api/v1/fee-heads`, `api/v1/fees`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly into all 3 classes).

| Class | HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|---|
| `FeeStructuresController` | `GET` | `api/v1/fee-structures` | `[Authorize]` | Query `classId` | `List<FeeStructureDto>` | Retrieves fee structures |
| `FeeStructuresController` | `POST` | `api/v1/fee-structures` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateFeeStructureRequest` | `FeeStructureDto` | Creates fee structure & items |
| `FeeStructuresController` | `PUT` | `api/v1/fee-structures/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateFeeStructureRequest` | `FeeStructureDto` | Updates fee structure & items |
| `FeeStructuresController` | `DELETE` | `api/v1/fee-structures/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Deletes fee structure |
| `FeeHeadsController` | `GET` | `api/v1/fee-heads` | `[Authorize]` | None | `List<FeeHeadDto>` | Retrieves fee heads |
| `FeeHeadsController` | `POST` | `api/v1/fee-heads` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateFeeHeadRequest` | `FeeHeadDto` | Creates a new fee head |
| `FeeHeadsController` | `PUT` | `api/v1/fee-heads/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateFeeHeadRequest` | `FeeHeadDto` | Updates a fee head |
| `FeeHeadsController` | `DELETE` | `api/v1/fee-heads/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Deletes a fee head |
| `FeesController` | `GET` | `api/v1/fees/student/{studentId}` | `[Authorize]` | None | `List<StudentFeeDto>` | Retrieves fee ledger for student |
| `FeesController` | `POST` | `api/v1/fees/payments` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CollectPaymentRequest` | `FeePaymentDto` | Records offline single fee payment |
| `FeesController` | `POST` | `api/v1/fees/payments/bulk` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CollectBulkPaymentRequest` | `BulkPaymentResponseDto` | Records bulk multi-head payment |
| `FeesController` | `GET` | `api/v1/fees/payments/{paymentId}/receipt` | `[Authorize]` | None | `FileContentResult` (PDF) | Generates QuestPDF receipt |
| `FeesController` | `GET` | `api/v1/fees/reports/collection` | `[Authorize(Roles = "Principal")]` | None | `FeeCollectionSummaryDto` | Institution cash/mode collection summary |
| `FeesController` | `GET` | `api/v1/fees/reports/defaulters` | `[Authorize(Roles = "Principal")]` | Query `classId` | `List<FeeDefaulterDto>` | Lists overdue unpaid fee accounts |
| `FeesController` | `GET` | `api/v1/fees/reports/defaulters/export` | `[Authorize(Roles = "Principal")]` | Query `classId` | `FileContentResult` (CSV) | Exports fee defaulters list to CSV |
| `FeesController` | `POST` | `api/v1/fees/online/create-order` | `[Authorize]` *(No role attr)* | `decimal amount` | Object | Creates Razorpay order |

#### 7. `StudentControllers.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs))
- Base Route: `api/v1/students`, `api/v1/parents`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly into both `StudentsController` and `ParentsController`).

| Class | HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|---|
| `StudentsController` | `GET` | `api/v1/students` | `[Authorize]` *(Class level only!)* | Query params (page, size, search, classId, status) | `PagedResult<StudentDto>` | Lists students (reveals passwords to admin) |
| `StudentsController` | `GET` | `api/v1/students/me` | `[Authorize]` | None | `StudentDto` | Current student profile |
| `StudentsController` | `GET` | `api/v1/students/{id}` | `[Authorize]` | None | `StudentDto` | Retrieves single student profile |
| `StudentsController` | `POST` | `api/v1/students` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateStudentRequest` | `StudentDto` | Creates user, student, and fees |
| `StudentsController` | `POST` | `api/v1/students/{id}/reset-password` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `ResetStudentPasswordRequest?` | Object with `newPassword` | Resets student password & returns plaintext |
| `StudentsController` | `PUT` | `api/v1/students/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `UpdateStudentRequest` | `IActionResult` | Updates student details |
| `StudentsController` | `DELETE` | `api/v1/students/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Soft-deletes student & user |
| `StudentsController` | `GET` | `api/v1/students/export` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | Query `classId` | `FileContentResult` (CSV) | Exports student roster to CSV |
| `ParentsController` | `GET` | `api/v1/parents/my-children` | `[Authorize]` | None | `List<StudentDto>` | Retrieves children linked to parent email |

#### 8. `SystemControllers.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/SystemControllers.cs))
- Base Route: `api/v1/notices`, `api/v1/notifications`, `api/v1/dashboard`, `api/v1/audit-logs`, `api/v1/health`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly into all 5 classes).
- **SECURITY FLAG:** `HealthController` has **NO** `[Authorize]` attribute and **NO** `[AllowAnonymous]` attribute.

| Class | HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|---|
| `NoticesController` | `GET` | `api/v1/notices` | `[Authorize]` | None | `List<NoticeDto>` | Gets published notices scoped by role/class |
| `NoticesController` | `POST` | `api/v1/notices` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | `CreateNoticeRequest` | `NoticeDto` | Creates official notice/circular |
| `NoticesController` | `DELETE` | `api/v1/notices/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | None | `IActionResult` | Deletes a notice |
| `NotificationsController` | `GET` | `api/v1/notifications` | `[Authorize]` | None | `List<NotificationDto>` | Gets user's in-app notifications |
| `NotificationsController` | `GET` | `api/v1/notifications/unread-count` | `[Authorize]` | None | `NotificationCountDto` | Unread notifications count |
| `NotificationsController` | `PUT` | `api/v1/notifications/{id}/read` | `[Authorize]` | None | `IActionResult` | Marks notification as read |
| `NotificationsController` | `PUT` | `api/v1/notifications/read-all` | `[Authorize]` | None | `IActionResult` | Marks all user notifications read |
| `DashboardController` | `GET` | `api/v1/dashboard/admin` | `[Authorize(Roles = "Principal")]` | None | `AdminDashboardDto` | Principal KPI dashboard metrics |
| `DashboardController` | `GET` | `api/v1/dashboard/accountant` | `[Authorize(Roles = "Principal")]` | None | `AccountantDashboardDto` | Accountant fee collection dashboard |
| `DashboardController` | `GET` | `api/v1/dashboard/teacher` | `[Authorize(Roles = "Principal,Teacher")]` | None | `TeacherDashboardDto` | Teacher schedule & attendance summary |
| `DashboardController` | `GET` | `api/v1/dashboard/student` | `[Authorize]` | Query `studentId` | `ParentStudentDashboardDto` | Student dashboard (timetable, marks, notices) |
| `DashboardController` | `GET` | `api/v1/dashboard/parent` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher,Student,Parent")]` | Query `studentId` | `ParentStudentDashboardDto` | Parent/student combined dashboard |
| `AuditLogsController` | `GET` | `api/v1/audit-logs` | `[Authorize(Roles = "Principal")]` | Query params (page, size, search, action, entity) | `PagedResult<AuditLogDto>` | Paginated administrative audit logs |
| `HealthController` | `GET` | `api/v1/health` | **NONE** *(Allows unauthenticated calls)* | None | `IActionResult` | Returns DB and system health status |

#### 9. `TeacherControllers.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/TeacherControllers.cs))
- Base Route: `api/v1/teachers`, `api/v1/timetable`, `api/v1/teacher-attendance`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly into all 3 classes).

| Class | HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|---|
| `TeachersController` | `GET` | `api/v1/teachers` | `[Authorize]` *(Class level only!)* | None | `List<TeacherDto>` | Lists faculty (reveals passwords to admin) |
| `TeachersController` | `GET` | `api/v1/teachers/{id}` | `[Authorize]` | None | `TeacherDto` | Gets teacher by ID |
| `TeachersController` | `POST` | `api/v1/teachers` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `CreateTeacherRequest` | `TeacherDto` | Creates faculty user & teacher profile |
| `TeachersController` | `POST` | `api/v1/teachers/{id}/reset-password` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `ResetTeacherPasswordRequest?` | Object with `newPassword` | Resets teacher password & returns plaintext |
| `TeachersController` | `PUT` | `api/v1/teachers/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `UpdateTeacherRequest` | `TeacherDto` | Updates teacher profile |
| `TeachersController` | `DELETE` | `api/v1/teachers/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Soft-deletes teacher & user |
| `TeachersController` | `POST` | `api/v1/teachers/{id}/allocations` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `AllocateTeacherRequest` | `IActionResult` | Allocates teacher to classroom & subject |
| `TeachersController` | `DELETE` | `api/v1/teachers/{id}/allocations/{allocationId}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Removes teacher allocation |
| `TeachersController` | `DELETE` | `api/v1/teachers/allocations/{allocationId}` | `[Authorize]` *(Method has NO role attr)* | None | `IActionResult` | Removes teacher allocation (fallback route) |
| `TimetableController` | `GET` | `api/v1/timetable/my-class` | `[Authorize]` | None | `List<TimetableEntryDto>` | Current student's class timetable |
| `TimetableController` | `GET` | `api/v1/timetable/class/{classId}` | `[Authorize]` | None | `List<TimetableEntryDto>` | Class timetable (students forbidden for other classes) |
| `TimetableController` | `GET` | `api/v1/timetable/teacher/{teacherId}` | `[Authorize]` | None | `List<TimetableEntryDto>` | Teacher personal weekly timetable |
| `TimetableController` | `GET` | `api/v1/timetable/academic-year/{academicYearId}/status` | `[Authorize]` | None | `TimetableStatusDto` | Checks if year timetable is locked/fixed |
| `TimetableController` | `POST` | `api/v1/timetable/academic-year/{academicYearId}/fix` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Locks year timetable against changes |
| `TimetableController` | `POST` | `api/v1/timetable/academic-year/{academicYearId}/unfix` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | None | `IActionResult` | Unlocks year timetable |
| `TimetableController` | `POST` | `api/v1/timetable` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | `CreateTimetableEntryRequest` | `TimetableEntryDto` | Adds period entry (checks overlap conflicts) |
| `TimetableController` | `DELETE` | `api/v1/timetable/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | None | `IActionResult` | Deletes a timetable period slot |
| `TeacherAttendanceController` | `GET` | `api/v1/teacher-attendance` | `[Authorize]` | Query `date` | `List<TeacherAttendanceDto>` | Gets faculty attendance records |
| `TeacherAttendanceController` | `POST` | `api/v1/teacher-attendance` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `MarkTeacherAttendanceRequest` | `IActionResult` | Marks attendance for faculty |

#### 10. `UsersController.cs` ([file](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/UsersController.cs))
- Base Route: `api/v1/users`
- Direct DbContext Access: **Yes** (`ApplicationDbContext db` injected directly).
- Class Authorization: `[Authorize(Roles = "Principal,SuperAdmin,Admin")]`

| HTTP | Route | Authorization | Request DTO | Response DTO | What It Does |
|---|---|---|---|---|---|
| `GET` | `api/v1/users` | Inherited from class | Query params (page, size, search, role) | `PagedResult<UserDto>` | Lists system users |
| `POST` | `api/v1/users` | Inherited from class | `CreateUserRequest` | `UserDto` | Creates a system user & roles |
| `PUT` | `api/v1/users/{id}/status` | Inherited from class | `UpdateUserStatusRequest` | Object | Activates or deactivates user |
| `PUT` | `api/v1/users/{id}/reset-password` | Inherited from class | `AdminResetPasswordRequest` | Object | Admin resets password & emails plaintext |
| `PUT` | `api/v1/users/{id}/roles` | Inherited from class | `UpdateUserRolesRequest` | Object | Replaces user assigned roles |

---

### Endpoints With NO Authorization Attribute (Flagged)

1. **`GET /api/v1/health`** in `HealthController` ([SystemControllers.cs:L819](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/SystemControllers.cs#L819)): Neither class nor method has `[Authorize]`. It allows unauthenticated calls to probe application and database status.
2. **`POST /api/v1/admissions/{id}/documents`** in `AdmissionsController` ([AdmissionsController.cs:L161](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L161)): Class has no `[Authorize]`, and method uses `[AllowAnonymous]`. Anyone knowing or guessing an admission UUID can upload arbitrary PDF files.

---

### Direct DbContext Access vs Services

**Every single controller (100% of 22 controller classes)** injects `ApplicationDbContext` directly into its constructor and executes LINQ queries, entity modifications, and `SaveChangesAsync()` inline. There is **no** service layer or repository pattern separating controller actions from database operations.

---

### Background / Hosted Services

Only **one** `IHostedService` exists in the entire system:
- **`NotificationOutboxWorker`** ([NotificationServices.cs:L183-278](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Notifications/NotificationServices.cs#L183-L278)).
  - **What it does:** Scans the `notification_outboxes` database table for rows with `status = Pending` and `next_retry_at <= UtcNow`, batches up to 10 items at a time, locates the registered `INotificationChannel` matching the record's `Channel` (`Email`, `Sms`, `WhatsApp`, `InApp`), and attempts delivery.
  - **Execution frequency:** Polls every **15 seconds** (`await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken)`).
  - **Retry behavior & Backoff:** On error, increments `RetryCount` and schedules retry with linear backoff: `NextRetryAt = DateTime.UtcNow.AddMinutes(item.RetryCount * 2)`.
  - **Failure handling:** If `RetryCount > 3`, updates status to `NotificationStatus.Failed`.
  - **CRITICAL FLAW in `EmailNotificationChannel` ([NotificationServices.cs:L87-91](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Notifications/NotificationServices.cs#L87-L91)):** When SMTP fails, it catches the exception and returns `true` ("Mark as delivered so dev doesn't stall if MailHog isn't currently up"). This causes failed emails to be marked `Sent` in the database, losing retry functionality.

---

### Error Handling & Stack Trace Exposure

- **Middleware:** Global error handling is implemented in `ExceptionHandlingMiddleware` ([ExceptionHandlingMiddleware.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Middleware/ExceptionHandlingMiddleware.cs)).
- **Format:** Returns RFC 7807 `application/problem+json` format.
- **Stack Traces:** Full stack traces (`ex.StackTrace`) are **not** written to the HTTP response; they are logged to Serilog.
- **INFORMATION DISCLOSURE RISK:** Line 57 sets `Detail = exception.Message`. Unhandled exceptions from Npgsql or runtime errors return raw database error messages, table names, constraint violations, and internal paths directly to API clients.

---

### Input Validation Architecture

- **FluentValidation:** Installed in `InstitutionErp.Application` (`FluentValidation` 11.9.0). 7 validators exist in [AppValidators.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Application/Validators/AppValidators.cs).
- **CRITICAL GAP:** `FluentValidation.AspNetCore` is **not** installed. Automatic model validation filter is **not** registered in `Program.cs`. `IValidator<T>` is **never** injected into any controller. Therefore, **FluentValidation is completely dormant and never executes at runtime**.
- **Data Annotations:** None used on request DTOs.
- **Actual Validation:** 100% ad-hoc, manual `if` checks in controllers (e.g. `if (string.IsNullOrWhiteSpace(request.Email))`). Endpoints missing manual validation accept empty or malformed inputs without rejection.

---

### Logging Framework & Sensitive Data Logging

- **Framework:** Serilog (`Serilog.AspNetCore` 8.0.1, `Serilog.Sinks.Console`, `Serilog.Sinks.File`).
- **Configuration:** Reads from `appsettings.json`, outputs to console and `logs/erp-.log`.
- **Sensitive Data in Logs:**
  - `DatabaseSeeder.cs` logs admin email at startup.
  - Audit logs record old/new values in plaintext JSON, capturing user profile and status mutations.
  - Controllers log email addresses and employee codes. Passwords themselves are not explicitly printed by `logger.LogInformation`, but in `UsersController.ResetPassword` and `AuthController.ChangePassword`, plaintext notification email bodies (containing new passwords) pass through memory and local SMTP.

---

### File Uploads Architecture

- **Implementation:** [FileStorageService.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Storage/FileStorageService.cs).
- **Endpoints:** `POST /api/v1/admissions/{id}/documents` ([AdmissionsController.cs:L161](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L161)).
- **Storage Location:** Local filesystem under `uploads/{folder}/{Guid}.pdf` (configured via `Storage:BasePath` in `appsettings.json` or fallback `AppDomain.CurrentDomain.BaseDirectory/uploads`). In Docker, mounted to volume `uploads_data:/app/uploads`.
- **Validation Checks:**
  - Extension check: Strict whitelist `.pdf` (checks `Path.GetExtension(fileName).ToLowerInvariant() == ".pdf"`).
  - Size check: 5 MB limit (`stream.Length > 5 * 1024 * 1024` throws exception).
  - MIME/Magic Bytes check: **NOT FOUND** (only checks file extension; no PDF magic byte `%PDF-` signature verification).

---

### External Integrations

1. **Email / SMTP:**
   - Provider: MailKit `4.7.1` / MimeKit `4.7.1` ([NotificationServices.cs:L52-93](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Notifications/NotificationServices.cs#L52-L93)).
   - Configuration: `Smtp:Host`, `Smtp:Port`, `Smtp:From` in `appsettings.json`. Configured for local MailHog (`localhost:1025`).
   - Error Handling: Silently catches exceptions, logs warning, and marks email as delivered.
2. **SMS:**
   - Provider: **STUB** (`SmsNotificationChannel` in [NotificationServices.cs:L95-111](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Notifications/NotificationServices.cs#L95-L111)). Logs to console; no external SMS provider is connected.
3. **WhatsApp:**
   - Provider: **STUB** (`WhatsAppNotificationChannel` in [NotificationServices.cs:L113-129](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Notifications/NotificationServices.cs#L113-L129)). Logs to console; no WhatsApp Cloud API is connected.
4. **Payment Gateway (Razorpay):**
   - Provider: Custom HMAC-SHA256 signature verifier ([RazorpayPaymentGateway.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Payment/RazorpayPaymentGateway.cs)). Official `Razorpay` SDK is **not** installed.
   - Configuration: `Payment:Razorpay:Enabled` (`false` by default), `Payment:Razorpay:KeyId`, `Payment:Razorpay:KeySecret`.
   - Security Gap: If `Payment:Razorpay:Enabled == false`, `VerifySignature` unconditionally returns `true` for all inputs.
5. **Storage:**
   - Provider: Local filesystem only (`FileStorageService`). No AWS S3, Azure Blob, or Google Cloud Storage integration.

---

## 3. Authentication, authorization, accounts

### Complete Auth Flows & Quoted Key Code

#### 1. Login Flow ([AuthController.cs:L42-238](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L42-L238))
Accepts user email, student ID (registration number), roll number, or teacher employee code. Resolves user entity, validates account is active and not locked, checks password against BCrypt hash, fallback checks against `DefaultPassword`, or dynamically validates computed student/teacher credentials. Generates JWT access token (15m), generates cryptographic 64-byte refresh token, hashes it with SHA-256, saves to `refresh_tokens` table, and returns both tokens with user profile.

```csharp
// Quoted key code from AuthController.cs:L107-117
var reqPass = (request.Password ?? string.Empty).Trim();
bool passwordMatches = _passwordHasher.VerifyPassword(reqPass, user.PasswordHash);
if (!passwordMatches)
{
    // 1. Check user.DefaultPassword (exact and case-insensitive)
    if (!string.IsNullOrWhiteSpace(user.DefaultPassword) &&
        (reqPass == user.DefaultPassword || string.Equals(reqPass, user.DefaultPassword, StringComparison.OrdinalIgnoreCase)))
    {
        passwordMatches = true;
    }
```

#### 2. Refresh Token Flow ([AuthController.cs:L240-310](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L240-L310))
Validates access token claims (even if expired) using `GetPrincipalFromExpiredToken`, hashes incoming refresh token with SHA-256, verifies `tokenHash` in DB is not expired and not revoked. Rotates token: marks old token `IsRevoked = true`, sets `ReplacedByTokenHash`, writes a newly generated refresh token to DB, and returns new access token and refresh token.

```csharp
// Quoted key code from AuthController.cs:L277-291
// Rotate refresh token
savedRefreshToken.IsRevoked = true;
var newRawRefreshToken = _jwtService.GenerateRefreshToken();
var newHashedToken = HashToken(newRawRefreshToken);
savedRefreshToken.ReplacedByTokenHash = newHashedToken;

_db.RefreshTokens.Add(new RefreshToken
{
    UserId = user.Id,
    TokenHash = newHashedToken,
    ExpiresAt = DateTime.UtcNow.AddDays(7),
    IsRevoked = false
});
await _db.SaveChangesAsync();
```

#### 3. Logout Flow ([AuthController.cs:L312-331](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L312-L331))
Revokes all active refresh tokens for the authenticated user and logs the action to `AuditLogs`.

```csharp
// Quoted key code from AuthController.cs:L318-326
var tokens = await _db.RefreshTokens
    .Where(r => r.UserId == _currentUserService.UserId.Value && !r.IsRevoked)
    .ToListAsync();

foreach (var t in tokens)
{
    t.IsRevoked = true;
}
await _db.SaveChangesAsync();
```

#### 4. Password Change Flow ([AuthController.cs:L333-382](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L333-L382))
Requires authentication. Verifies current password against hash, updates BCrypt hash, **overwrites `user.DefaultPassword = request.NewPassword` in plaintext**, and queues a confirmation email.

```csharp
// Quoted key code from AuthController.cs:L347-356
if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
{
    return BadRequest(new { message = "Current password is incorrect." });
}

user.DefaultPassword = request.NewPassword;
user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
user.LockoutEnd = null;
user.AccessFailedCount = 0;
await _db.SaveChangesAsync();
```

#### 5. Forgot Password Flow ([AuthController.cs:L384-430](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L384-L430))
Generates a 6-digit numeric verification code using `RandomNumberGenerator.GetInt32(100000, 999999)`, sets `PasswordResetToken` with 2-hour expiration, and dispatches an HTML email with the reset code.

```csharp
// Quoted key code from AuthController.cs:L391-396
// Generate a 6-digit user-friendly code
var resetCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
user.PasswordResetToken = resetCode;
user.PasswordResetTokenExpires = DateTime.UtcNow.AddHours(2);
await _db.SaveChangesAsync();
```

#### 6. Reset Password Flow ([AuthController.cs:L432-488](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L432-L488))
Validates the 6-digit code and expiration, updates BCrypt hash, **stores plaintext in `user.DefaultPassword`**, revokes all active refresh tokens, and queues a confirmation email.

```csharp
// Quoted key code from AuthController.cs:L447-460
user.DefaultPassword = request.NewPassword;
user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
user.PasswordResetToken = null;
user.PasswordResetTokenExpires = null;
user.LockoutEnd = null;
user.AccessFailedCount = 0;

// Revoke any active refresh tokens to terminate stale sessions
var refreshTokens = await _db.RefreshTokens
    .Where(rt => rt.UserId == user.Id && !rt.IsRevoked)
    .ToListAsync();
foreach (var rt in refreshTokens) rt.IsRevoked = true;
await _db.SaveChangesAsync();
```

---

### JWT Settings & Secret Storage

- **Algorithm:** HMAC-SHA256 (`SecurityAlgorithms.HmacSha256`)
- **Key Length:** 72 bytes / 576 bits (well exceeds the 256-bit minimum).
- **Issuer:** `InstitutionErp`
- **Audience:** `InstitutionErpApp` (Api `Program.cs` and `JwtTokenService.cs`), `InstitutionErpUsers` in `.env.example`/`docker-compose.yml`.
- **Access Token Expiration:** 15 minutes (`ExpiryMinutes: "15"`).
- **Where Secret is Stored:**
  - `d:\CLG APP\institution-erp\backend\src\InstitutionErp.Api\appsettings.json` (Key: `Jwt:Secret`, Value: `<REDACTED>`) — **Committed in git repo**, real-looking static secret.
  - Hardcoded fallback in `Program.cs:L39` and `JwtTokenService.cs:L23` if configuration missing: `<REDACTED>`.

---

### Refresh Token Handling

- **Storage:** Database table `refresh_tokens`.
- **Hashing:** Cryptographic raw 64-byte token generated via `RandomNumberGenerator.GetBytes(64)`, Base64-encoded, then hashed with **SHA-256** prior to database insertion.
- **Rotation:** Supported. When `/auth/refresh` is called, the old token is flagged `is_revoked = true`, `replaced_by_token_hash` is recorded, and an entirely new token is inserted.
- **Revocation:** Supported on `/auth/logout`, password reset, admin password reset, and student deactivation.
- **Reuse Detection:** Partial. Revoked tokens are excluded via `&& !r.IsRevoked`. If an attacker submits an already-revoked refresh token, the endpoint returns `401 Unauthorized`. However, it does **not** trigger family revocation (invalidating all tokens of that user).

---

### Frontend Token Storage

Tokens are stored directly in **`localStorage`** via JavaScript, making them accessible to any script running in the DOM and vulnerable to Cross-Site Scripting (XSS).

```typescript
// Quoted from frontend/src/store/authContext.tsx:L38-40
localStorage.setItem('erp_access_token', res.accessToken);
localStorage.setItem('erp_refresh_token', res.refreshToken);
localStorage.setItem('erp_user', JSON.stringify(res.user));
```

---

### Roles, Seeded Data & Role Matrix

- **Role Names Defined in Domain:** `Principal`, `Teacher`, `Student` ([Enums.cs:L3-8](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Domain/Enums/Enums.cs#L3-L8)).
- **Role String Constants:** **NOT FOUND**. Roles are written as repeated string literals throughout controllers (`"Principal"`, `"Teacher"`, `"Student"`).
- **Legacy / Compatibility Strings:** Literals `"SuperAdmin"`, `"Admin"`, `"Accountant"`, and `"Parent"` appear across attributes and policies, but map to `Principal` in policies or fail unless explicitly granted.

#### Role Capability Matrix

| Capability / Resource | Principal (Admin) | Teacher (Faculty) | Student |
|---|---|---|---|
| View Administrative Dashboard & KPI Revenue | Yes | No | No |
| User Provisioning & Role Modification | Yes | No | No |
| View All System Audit Logs | Yes | No | No |
| Review / Approve / Reject Online Admissions | Yes | No | No |
| Create / Delete Classrooms & Subjects | Yes | No | No |
| Allocate Teachers to Classrooms & Subjects | Yes | No | No |
| Create / Lock / Publish Examinations | Yes | No | No |
| Enter / Edit Student Exam Marks | **No** (Explicitly blocked) | **Yes** (Allocated subject only) | No |
| Mark Student Daily Attendance | Yes | Yes (Allocated class only) | No |
| View Class Attendance Sheets | Yes | Yes (Allocated class only) | Yes *(Leak via open scoping)* |
| View Student Personal Marks & Report Card | Yes | Yes (Allocated class) | Yes (Own marks only) |
| Configure Fee Structures & Fee Heads | Yes | No | No |
| Collect & Record Fee Payments | Yes | No | No |
| View Fee Defaulters & Financial Summaries | Yes | No | No |
| Download Fee Payment Receipts | Yes | Yes *(Leak via open scoping)* | Yes (Own receipts only) |
| View / Reset Plaintext Passwords of Users | Yes (via API responses) | No | No |
| Publish Official Campus Notices | Yes (Institution-wide) | Yes (Allocated class only) | No |
| View Weekly Class Timetable | Yes | Yes (Own / Class) | Yes (Enrolled class only) |

---

### The `default_password` / `DefaultPassword` Property Audit

`DefaultPassword` is a column on the `users` table that stores user passwords in **cleartext**.

#### Full List of References:
1. **[User.cs:L19](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Domain/Entities/User.cs#L19):** Property declaration: `public string? DefaultPassword { get; set; }`.
2. **[DatabaseSeeder.cs:L69,L83](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Seeding/DatabaseSeeder.cs#L69):** Writes cleartext admin password from configuration into database on creation and on every restart.
3. **[Program.cs:L166](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L166):** Raw SQL migration adding column: `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_password text NULL;`.
4. **[AuthController.cs:L112-113](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L112-L113):** Reads cleartext password on login and compares against submitted credentials.
5. **[AuthController.cs:L177](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L177):** Updates `user.DefaultPassword = reqPass;` on successful login.
6. **[AuthController.cs:L352](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L352):** Overwrites `user.DefaultPassword = request.NewPassword;` in cleartext when user changes password.
7. **[AuthController.cs:L447](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L447):** Overwrites `user.DefaultPassword = request.NewPassword;` in cleartext when user resets password.
8. **[AdmissionsController.cs:L409,L584,L601](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L409):** Sets cleartext generated password on student user creation and restores.
9. **[AdmissionsController.cs:L729](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L729):** Returns `generatedPassword` in cleartext JSON response of `PUT /api/v1/admissions/{id}/status`.
10. **[StudentControllers.cs:L124](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L124):** Reads `GeneratedPassword = s.User.DefaultPassword` in `GET /api/v1/students`.
11. **[StudentControllers.cs:L253-255](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L253-L255):** Reads `GeneratedPassword = s.User.DefaultPassword` in `GET /api/v1/students/{id}`.
12. **[StudentControllers.cs:L307](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L307):** Writes cleartext password in `POST /api/v1/students`.
13. **[StudentControllers.cs:L445,L463,L541](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L445):** Sets cleartext password, returns it in `StudentDto`, and returns it in `ResetPassword` response object.
14. **[TeacherControllers.cs:L63,L127,L169,L278,L334](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/TeacherControllers.cs#L63):** Reads, writes, and returns cleartext teacher passwords in `GET /api/v1/teachers`, `GET /api/v1/teachers/{id}`, `POST /api/v1/teachers`, and reset password.

- **DTOs Exposing Generated Passwords:**
  - `StudentDto.GeneratedPassword` ([StudentDtos.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Application/DTOs/StudentDtos.cs))
  - `TeacherDto.GeneratedPassword` ([TeacherDtos.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Application/DTOs/TeacherDtos.cs))

---

### `PasswordGenerator` Usage & Callers

Defined in [PasswordGenerator.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Application/Common/Utils/PasswordGenerator.cs):
1. `GenerateStudentPassword(email, rollNumber)`: Format `first3letters@rollNumber` (e.g. `priti@gmail.com` with roll 101 -> `pri@101`).
   - Callers:
     - `AuthController.cs:L130` (fallback login formula verification)
     - `AdmissionsController.cs:L402,L566` (assigning password upon application approval)
     - `StudentControllers.cs:L134,L255,L298,L461` (listing students, creating student, resetting student password)
2. `GenerateTeacherPassword(name, employeeCode)`: Format `name$employeeCode` (e.g. `Sarah` with `TCH-001` -> `Sarah$TCH-001`).
   - Callers:
     - `AuthController.cs:L155-156` (fallback login formula verification)
     - `TeacherControllers.cs:L84,L129,L161,L276` (listing teachers, creating teacher, resetting teacher password)
3. `Generate(length)`: Cryptographic random character generation.
   - Callers: Only referenced in unit tests (`BusinessLogicTests.cs:L116,L131`). Not called by application logic.

---

### "Must Change Password on First Login" Flag

- Server Enforcement: **NOT FOUND**.
- Model Flag: **NOT FOUND**. There is no column or property indicating whether a user has logged in for the first time or must change their password.
- Notice: The email dispatch templates contain a text disclaimer stating *"Security Notice: Please change your password upon your first login"*, but no server gate or redirect is implemented.

---

### Rate Limiting & Account Lockout

- **Rate Limiting:** Fixed window limiter configured on `"auth-limit"` (15 permits/minute).
  - **GAP:** While registered in `Program.cs`, the attribute `[EnableRateLimiting("auth-limit")]` is **never applied** to `AuthController` or its endpoints. Therefore, API rate limiting is inactive.
- **Account Lockout:** Active in `AuthController.Login` ([AuthController.cs:L189-196](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AuthController.cs#L189-L196)). After 5 failed password attempts (`user.AccessFailedCount >= 5`), `user.LockoutEnd` is set to `DateTime.UtcNow.AddMinutes(15)`, returning HTTP `423 Locked`. Successful login clears `AccessFailedCount` and `LockoutEnd`.

---

### Public Registration & Unrestricted Field Setting

- **Public Signup:** There is **no** public user registration endpoint. The only anonymous endpoint is `POST /api/v1/admissions/apply`, which creates an admission application in `Submitted` status.
- **Field Setting:** On `POST /api/v1/users`, administrators pass `CreateUserRequest` containing `Roles: string[]`, allowing arbitrary assignment of any role in the database.

---

### Authorization Gaps & Conditional Scoping (Fail Open Checks)

Several controllers enforce tenant/user scoping using conditional `if (role)` blocks that **fail open** for unhandled roles:

1. **`AttendanceController.GetClassAttendance` ([AttendanceController.cs:L153-163](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AttendanceController.cs#L153-L163)):**
   - Code: `if (_currentUserService.IsInRole("Teacher") && !isAdmin) { ... verify allocation ... }`
   - **Vulnerability:** If a user with role `Student` calls this endpoint, the check evaluates to `false` and is skipped entirely. A student can view full attendance logs of any class.
2. **`StudentControllers.GetStudents` ([StudentControllers.cs:L76-95](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L76-L95)):**
   - Code: `if (!isAdmin && User.IsInRole("Teacher")) { ... filter by teacher class ... }`
   - **Vulnerability:** If a student calls `GET /api/v1/students`, the condition is bypassed and all student profiles across the entire school are returned.
3. **`StudentControllers.GetStudent` ([StudentControllers.cs:L218-228](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L218-L228)):**
   - Code: `if (!isAdmin && User.IsInRole("Teacher")) { ... check teacher allocation ... }`
   - **Vulnerability:** Any student can request `GET /api/v1/students/{id}` for any student ID in the institution.
4. **`FeeControllers.GetStudentFees` ([FeeControllers.cs:L459-469](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/FeeControllers.cs#L459-L469)):**
   - Code: Checks `if (IsInRole("Student"))` and `else if (IsInRole("Parent"))`.
   - **Vulnerability:** If a user with role `Teacher` calls `GET /api/v1/fees/student/{studentId}`, both checks evaluate to `false`, allowing faculty members to view the financial ledgers of any student.
5. **`ExamControllers.SaveMarks` ([ExamControllers.cs:L509-522](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/ExamControllers.cs#L509-L522)):**
   - Code: `var hasAllocations = await _db.TeacherAllocations.AnyAsync(a => a.TeacherId == teacher.Id && !a.IsDeleted); if (hasAllocations) { ... check subject allocation ... }`
   - **Vulnerability:** If a newly created teacher account has 0 allocations in the system (`!hasAllocations`), the allocation check is skipped and the teacher can enter marks for any subject in any exam.

---

### Database Seeding Audit

- **Seeder File:** [DatabaseSeeder.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Seeding/DatabaseSeeder.cs).
- **Execution:** Runs in `Program.cs:L171` inside `app.Services.CreateScope()` on **every application startup in all environments** (no environment check).
- **What Gets Seeded:**
  1. Roles: All values of `Enum.GetNames<UserRoleType>()` (`Principal`, `Teacher`, `Student`).
  2. Administrator: Email from `_config["Admin:Email"]` (`admin@gmail.com`), password from `_config["Admin:Password"]` (`admin@123`).
  3. Reference Data: Grade Scales (`A+` through `F`) if none exist; default active Academic Year (`2026-2027`) if none active.
- **CRITICAL RE-SEEDING BUG ([DatabaseSeeder.cs:L80-93](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Seeding/DatabaseSeeder.cs#L80-L93)):** If the administrator account already exists, the seeder **overwrites** `adminUser.PasswordHash` and `adminUser.DefaultPassword` back to the configuration value on every application restart. Any password changed by the administrator in production will be silently reverted upon server reboot.

---

### Audit Logging

- **Service:** `AuditLogService` implementing `IAuditLogService` ([AuditLogService.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Audit/AuditLogService.cs)).
- **Database Table:** `audit_logs`. Captures: `UserId`, `UserEmail`, `Action`, `EntityName`, `EntityId`, `OldValuesJson`, `NewValuesJson`, `IpAddress`, `CreatedAt`.
- **Usage:** Injected and invoked across 10 controllers for critical mutations (User create/status/roles, admission status changes, attendance marking, fee collection, marks entry, timetable modification).

---

## 4. Database

### Provider, DbContext & Connection String

- **Provider:** PostgreSQL via `Npgsql.EntityFrameworkCore.PostgreSQL` `8.0.4`.
- **DbContext Class:** `ApplicationDbContext` implementing `IApplicationDbContext` ([ApplicationDbContext.cs](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Persistence/ApplicationDbContext.cs)).
- **Connection String Loading:** Read in `DependencyInjection.cs:L20` from `configuration.GetConnectionString("DefaultConnection")` with fallback to `Host=localhost;Port=5432;Database=institution_erp;Username=postgres;Password=<REDACTED>;`.

---

### Entities & Database Schema Tables

All entities inherit from `BaseEntity` (except `RefreshToken`, `UserRole`, `GradeScale`, and `AppSetting` which have custom keys or inherit directly). Table and column names use PostgreSQL `snake_case`.

| Table Name | Entity Class | Primary Key | Key Columns & Types | Foreign Keys & Relationships | Indexes / Unique Constraints | Soft Delete |
|---|---|---|---|---|---|---|
| `users` | `User` | `id` (uuid) | `email` (text), `password_hash` (text), `default_password` (text), `first_name` (text), `last_name` (text), `phone_number` (text), `is_active` (bool), `access_failed_count` (int), `lockout_end` (timestamptz) | 1:N `user_roles`, 1:N `refresh_tokens` | Unique: `email` | Yes (`is_deleted`) |
| `roles` | `Role` | `id` (uuid) | `name` (text), `description` (text) | 1:N `user_roles` | Unique: `name` | Yes (`is_deleted`) |
| `user_roles` | `UserRole` | Composite: `(user_id, role_id)` | `user_id` (uuid), `role_id` (uuid) | FK: `users(id)`, FK: `roles(id)` (OnDelete: Cascade) | Composite PK | No |
| `refresh_tokens` | `RefreshToken` | `id` (uuid) | `token_hash` (text), `expires_at` (timestamptz), `is_revoked` (bool), `replaced_by_token_hash` (text) | FK: `users(id)` | Index: `user_id` | Yes (`is_deleted`) |
| `academic_years` | `AcademicYear` | `id` (uuid) | `name` (text), `start_date` (timestamptz), `end_date` (timestamptz), `is_active` (bool) | 1:N `classes`, 1:N `exams`, 1:N `fee_structures` | None | Yes (`is_deleted`) |
| `classes` | `ClassRoom` | `id` (uuid) | `name` (text), `section` (text), `capacity` (int), `academic_year_id` (uuid) | FK: `academic_years(id)` | None | Yes (`is_deleted`) |
| `subjects` | `Subject` | `id` (uuid) | `name` (text), `code` (text), `description` (text) | 1:N `class_subjects` | None | Yes (`is_deleted`) |
| `class_subjects` | `ClassSubject` | `id` (uuid) | `class_room_id` (uuid), `subject_id` (uuid) | FK: `classes(id)`, FK: `subjects(id)` | None | Yes (`is_deleted`) |
| `teachers` | `Teacher` | `id` (uuid) | `user_id` (uuid), `employee_code` (text), `qualification` (text), `specialization` (text), `status` (int) | FK: `users(id)` | None | Yes (`is_deleted`) |
| `teacher_allocations` | `TeacherAllocation` | `id` (uuid) | `teacher_id` (uuid), `class_room_id` (uuid), `subject_id` (uuid), `is_class_teacher` (bool) | FK: `teachers(id)`, FK: `classes(id)`, FK: `subjects(id)` | None | Yes (`is_deleted`) |
| `timetable_entries` | `TimetableEntry` | `id` (uuid) | `class_room_id` (uuid), `teacher_id` (uuid), `subject_id` (uuid), `day_of_week` (int), `period_number` (int), `start_time` (time), `end_time` (time), `room_number` (text) | FK: `classes(id)`, FK: `teachers(id)`, FK: `subjects(id)` | Indexes: `(class_room_id, day_of_week, period_number)`, `(teacher_id, day_of_week, period_number)` | Yes (`is_deleted`) |
| `teacher_attendances` | `TeacherAttendance` | `id` (uuid) | `teacher_id` (uuid), `date` (timestamptz), `status` (int), `remarks` (text), `marked_by` (text) | FK: `teachers(id)` | None | Yes (`is_deleted`) |
| `students` | `Student` | `id` (uuid) | `user_id` (uuid), `student_registration_number` (text), `roll_number` (text), `date_of_birth` (timestamptz), `gender` (int), `class_room_id` (uuid), `status` (int), `guardian_name` (text), `guardian_phone` (text), `guardian_email` (text) | FK: `users(id)`, FK: `classes(id)` | Unique: `student_registration_number` | Yes (`is_deleted`) |
| `attendances` | `Attendance` | `id` (uuid) | `student_id` (uuid), `class_room_id` (uuid), `date` (timestamptz), `status` (int), `remarks` (text), `marked_by` (text) | FK: `students(id)`, FK: `classes(id)` | Unique: `(student_id, date)` | Yes (`is_deleted`) |
| `admissions` | `Admission` | `id` (uuid) | `reference_number` (text), `first_name` (text), `last_name` (text), `email` (text), `phone_number` (text), `status` (int), `desired_class_room_id` (uuid), `created_student_id` (uuid) | FK: `classes(id)`, FK: `students(id)` | None | Yes (`is_deleted`) |
| `admission_documents` | `AdmissionDocument` | `id` (uuid) | `admission_id` (uuid), `document_type` (text), `file_name` (text), `file_path` (text), `file_size` (bigint), `content_type` (text) | FK: `admissions(id)` | None | Yes (`is_deleted`) |
| `admission_status_histories` | `AdmissionStatusHistory` | `id` (uuid) | `admission_id` (uuid), `from_status` (int), `to_status` (int), `remarks` (text), `changed_by` (text), `changed_at` (timestamptz) | FK: `admissions(id)` | None | Yes (`is_deleted`) |
| `fee_heads` | `FeeHead` | `id` (uuid) | `name` (text), `description` (text), `is_mandatory` (bool) | 1:N `fee_structure_items` | None | Yes (`is_deleted`) |
| `fee_structures` | `FeeStructure` | `id` (uuid) | `name` (text), `academic_year_id` (uuid), `class_room_id` (uuid), `frequency` (int), `total_amount` (numeric) | FK: `academic_years(id)`, FK: `classes(id)` | None | Yes (`is_deleted`) |
| `fee_structure_items` | `FeeStructureItem` | `id` (uuid) | `fee_structure_id` (uuid), `fee_head_id` (uuid), `amount` (numeric), `due_date` (timestamptz) | FK: `fee_structures(id)`, FK: `fee_heads(id)` | None | Yes (`is_deleted`) |
| `student_fees` | `StudentFee` | `id` (uuid) | `student_id` (uuid), `fee_structure_item_id` (uuid), `base_amount` (numeric), `discount_amount` (numeric), `late_fee_amount` (numeric), `paid_amount` (numeric), `due_date` (timestamptz), `status` (int) | FK: `students(id)`, FK: `fee_structure_items(id)` | None | Yes (`is_deleted`) |
| `fee_payments` | `FeePayment` | `id` (uuid) | `student_fee_id` (uuid), `amount` (numeric), `mode` (int), `transaction_reference` (text), `payment_date` (timestamptz), `received_by` (text) | FK: `student_fees(id)`, 1:1 `receipts` | None | Yes (`is_deleted`) |
| `fee_receipts` | `FeeReceipt` | `id` (uuid) | `fee_payment_id` (uuid), `receipt_number` (text), `issue_date` (timestamptz), `pdf_storage_path` (text) | FK: `fee_payments(id)` (1:1) | None | Yes (`is_deleted`) |
| `exams` | `Exam` | `id` (uuid) | `name` (text), `type` (int), `academic_year_id` (uuid), `class_room_id` (uuid), `start_date` (timestamptz), `end_date` (timestamptz), `is_published` (bool), `is_locked` (bool) | FK: `academic_years(id)`, FK: `classes(id)` | None | Yes (`is_deleted`) |
| `exam_subjects` | `ExamSubject` | `id` (uuid) | `exam_id` (uuid), `subject_id` (uuid), `max_marks` (numeric), `pass_marks` (numeric), `exam_date` (timestamptz) | FK: `exams(id)`, FK: `subjects(id)` | None | Yes (`is_deleted`) |
| `exam_marks` | `ExamMark` | `id` (uuid) | `exam_subject_id` (uuid), `student_id` (uuid), `marks_obtained` (numeric), `is_absent` (bool), `remarks` (text), `entered_by` (text) | FK: `exam_subjects(id)`, FK: `students(id)` | None | Yes (`is_deleted`) |
| `grade_scales` | `GradeScale` | `id` (uuid) | `grade_letter` (text), `min_percentage` (numeric), `max_percentage` (numeric), `grade_point` (numeric), `description` (text) | System reference metrics | None | Yes (`is_deleted`) |
| `notices` | `Notice` | `id` (uuid) | `title` (text), `content` (text), `audience` (int), `target_class_room_id` (uuid), `expiry_date` (timestamptz), `attachment_url` (text), `is_pinned` (bool), `posted_by` (text) | FK: `classes(id)` | None | Yes (`is_deleted`) |
| `notifications` | `Notification` | `id` (uuid) | `user_id` (uuid), `title` (text), `message` (text), `channel` (int), `is_read` (bool), `reference_type` (text), `reference_id` (text) | FK: `users(id)` | None | Yes (`is_deleted`) |
| `notification_outboxes` | `NotificationOutbox` | `id` (uuid) | `channel` (int), `recipient` (text), `subject` (text), `body` (text), `payload_json` (text), `status` (int), `retry_count` (int), `next_retry_at` (timestamptz), `error_message` (text) | None | None | Yes (`is_deleted`) |
| `audit_logs` | `AuditLog` | `id` (uuid) | `user_id` (uuid), `user_email` (text), `action` (text), `entity_name` (text), `entity_id` (text), `old_values_json` (text), `new_values_json` (text), `ip_address` (text) | FK: `users(id)` | None | Yes (`is_deleted`) |
| `app_settings` | `AppSetting` | `id` (uuid) | `key` (text), `value` (text), `description` (text), `category` (text) | None | None | Yes (`is_deleted`) |

---

### Text Relationship Diagram

```
User (1) ──── (M) UserRole (M) ──── (1) Role
User (1) ──── (M) RefreshToken
User (1) ──── (1) Teacher (1) ──── (M) TeacherAllocation (M) ──── (1) ClassRoom
User (1) ──── (1) Student (1) ──── (M) Attendance (M) ──── (1) ClassRoom
AcademicYear (1) ──── (M) ClassRoom (1) ──── (M) ClassSubject (M) ──── (1) Subject
ClassRoom (1) ──── (M) TimetableEntry (M) ──── (1) Teacher
ClassRoom (1) ──── (M) Exam (1) ──── (M) ExamSubject (1) ──── (M) ExamMark (M) ──── (1) Student
ClassRoom (1) ──── (M) FeeStructure (1) ──── (M) FeeStructureItem (1) ──── (M) StudentFee (1) ──── (M) FeePayment (1) ──── (1) FeeReceipt
ClassRoom (1) ──── (M) Admission (1) ──── (M) AdmissionDocument
Notice (M) ──── (1) ClassRoom (Optional target)
Notification (M) ──── (1) User
AuditLog (M) ──── (1) User (Optional)
```

---

### EF Core Migrations & Manual SQL

- **Migration Files:** **NOT FOUND**. There are 0 EF Core migration files in the entire solution.
- **How Schema is Applied:**
  - `Program.cs:L163`: `await db.Database.EnsureCreatedAsync();`.
  - `Program.cs:L166`: Manual SQL `await db.Database.ExecuteSqlRawAsync("ALTER TABLE users ADD COLUMN IF NOT EXISTS default_password text NULL;");`.
  - **DANGER:** `EnsureCreatedAsync()` bypasses EF Core migrations completely. If model changes occur, `EnsureCreatedAsync()` will not alter existing tables. The codebase attempted to patch this by executing raw `ALTER TABLE` statements in `try...catch` blocks at startup.

---

### Known Performance & Query Anti-Patterns

1. **Unpaginated Table Dumps:**
   - `TeachersController.GetTeachers`: Dumps all faculty, their users, allocations, classes, and subjects in one request.
   - `ExamControllers.GetExams`: Dumps all exams and exam subjects across all academic years without pagination.
   - `AcademicControllers.GetClasses`: Dumps all classes.
   - `FeeControllers.GetStructures` & `GetHeads`: Dumps entire fee catalog.
2. **In-Memory Filtering / Table Scanning:**
   - In `ExamControllers.GetExams:L83`, the controller runs `await _db.TeacherAllocations.Include(...).ToListAsync()`, loading the entire institution's allocation table into memory, and then runs LINQ-in-memory matching inside a nested loop for every subject of every exam.
3. **Database Sequence Generation via In-Memory Loops:**
   - In `AdmissionsController.Apply:L48-69` and `StudentControllers.Create:L272-294`, sequences for reference numbers (`ADM-2026-####`) and registration numbers (`2026-CLS-####`) are calculated by pulling all strings matching prefix from the DB into a C# `List<string>`, parsing with a `foreach` loop, and then executing a `while (AnyAsync(...))` query in a loop. Under concurrent traffic, this causes severe race conditions and duplicate key exceptions.
4. **Missing Transactions:**
   - No explicit transactions (`IDbContextTransaction` / `BeginTransactionAsync`) are used anywhere in the codebase. Multi-stage writes (e.g. creating user -> creating student -> creating fee items) call `SaveChangesAsync()` multiple times sequentially. If any stage fails, partial data remains orphaned in the database.

---

### Personal & Sensitive Data Inventory

| Table Name | Sensitive / PII Columns | Sensitivity Level |
|---|---|---|
| `users` | `email`, `password_hash`, `default_password`, `first_name`, `last_name`, `phone_number` | **Critical** (Plaintext passwords, PII) |
| `students` | `roll_number`, `date_of_birth`, `gender`, `blood_group`, `address`, `guardian_name`, `guardian_phone`, `guardian_email` | **High** (Minor PII, medical/guardian data) |
| `admissions` | `first_name`, `last_name`, `email`, `phone_number`, `date_of_birth`, `address`, `guardian_name`, `guardian_phone`, `guardian_email`, `previous_school_percentage` | **High** (Applicant PII) |
| `admission_documents` | `file_path`, `file_name` | **High** (Government IDs, mark sheets stored on disk) |
| `fee_payments` | `transaction_reference`, `amount`, `received_by` | **Medium** (Banking / UPI / Cheque reference numbers) |
| `exam_marks` | `marks_obtained`, `remarks` | **Medium** (Educational performance data) |

---

### Database Configuration (Local vs Supabase)

- **Status:** **Local PostgreSQL** (PostgreSQL 18 on port 5432).
- **Supabase:** **NOT CONNECTED** (no Supabase references in code or configuration).
- **Current Connection String:** `Host=localhost;Port=5432;Database=institution_erp;Username=postgres;Password=<REDACTED>;` (configured in `appsettings.json` and `.env.example`).

---

## 5. Frontend

### Folder Structure of `src` (3 Levels Deep)

```
frontend/src/
├── api/
│   ├── client.ts
│   └── endpoints.ts
├── assets/
├── components/
│   ├── common/
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Navbar.tsx
│   │   ├── Select.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   └── Table.tsx
├── layouts/
│   ├── MainLayout.tsx
│   └── PublicLayout.tsx
├── pages/
│   ├── academics/
│   │   ├── ClassesPage.tsx
│   │   └── TimetablePage.tsx
│   ├── admin/
│   │   ├── AuditLogsPage.tsx
│   │   └── UsersPage.tsx
│   ├── admissions/
│   │   └── AdmissionsQueuePage.tsx
│   ├── attendance/
│   │   └── MarkAttendancePage.tsx
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── PasswordPages.tsx
│   ├── dashboards/
│   │   ├── AdminDashboardPage.tsx
│   │   ├── ParentDashboardPage.tsx
│   │   └── TeacherDashboardPage.tsx
│   ├── exams/
│   │   ├── ExamsListPage.tsx
│   │   ├── MarksEntryPage.tsx
│   │   └── ResultsViewPage.tsx
│   ├── fees/
│   │   ├── FeeDefaultersPage.tsx
│   │   └── FeeManagementPage.tsx
│   ├── notices/
│   │   └── NoticesPage.tsx
│   ├── public/
│   │   └── AdmissionPublicPages.tsx
│   ├── students/
│   │   └── StudentsListPage.tsx
│   └── teachers/
│       └── TeachersListPage.tsx
├── routes/
│   └── AppRoutes.tsx
├── store/
│   ├── authContext.tsx
│   └── themeContext.tsx
├── types/
│   └── index.ts
└── utils/
```

---

### Route Guards & Client-Side Access Control

Client-side routing is guarded at two levels in [AppRoutes.tsx](file:///d:/CLG%20APP/institution-erp/frontend/src/routes/AppRoutes.tsx) and [MainLayout.tsx](file:///d:/CLG%20APP/institution-erp/frontend/src/layouts/MainLayout.tsx):

1. **Authentication Check in `MainLayout.tsx:L22-24`:**
```typescript
if (!isAuthenticated) {
  return <Navigate to="/login" replace />;
}
```

2. **Role-Based Dispatchers & Guards in `AppRoutes.tsx:L98-104`:**
```typescript
// Staff Only Guard
const StaffOnly: React.FC<{ children: React.ReactNode; fallback?: string }> = ({ children, fallback = '/dashboard' }) => {
  const { hasRole } = useAuth();
  if (hasRole('Student')) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
};
```

---

### API Layer & Configuration

- **Base URL Configuration ([frontend/src/api/client.ts:L3](file:///d:/CLG%20APP/institution-erp/frontend/src/api/client.ts#L3)):**
```typescript
const API_BASE_URL = '/api/v1';
```
In development, requests to `/api` are proxied to `http://localhost:5050` by Vite dev server (`vite.config.ts:L9-15`). In production Docker, Nginx proxies `/api/` to `http://backend:5050/api/` (`nginx.conf:L20-30`).
- **Auth Headers ([client.ts:L13-19](file:///d:/CLG%20APP/institution-erp/frontend/src/api/client.ts#L13-L19)):**
```typescript
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```
- **401 Refresh Handling:** Implemented via Axios response interceptor in `client.ts:L39-98`. If a 401 is received, queues failed requests, invokes `POST /api/v1/auth/refresh` using tokens from `localStorage`, updates storage with new tokens, and replays failed calls. If refresh fails, executes `localStorage.clear()` and forces redirect to `/login`.
- **Hardcoded URLs:** No hardcoded absolute backend URLs exist in React components; all requests utilize `apiClient` relative routes.

---

### Pages & API Calls Inventory

| Page Component | Route | API Endpoints Invoked | Authorized Roles | Notes |
|---|---|---|---|---|
| `LoginPage` | `/login` | `POST /auth/login` | Public | Authenticates user into local storage |
| `ForgotPasswordPage` | `/forgot-password` | `POST /auth/forgot-password` | Public | Dispatches reset email |
| `ResetPasswordPage` | `/reset-password` | `POST /auth/reset-password` | Public | Submits new password |
| `ApplyAdmissionPage` | `/admissions/apply` | `POST /admissions/apply`, `GET /classes` | Public | Public applicant admission form |
| `AdminDashboardPage` | `/dashboard` (Principal) | `GET /dashboard/admin`, `GET /notices` | Principal | Financial and institutional overview KPIs |
| `TeacherDashboardPage` | `/dashboard` (Teacher) | `GET /dashboard/teacher`, `GET /notices` | Teacher | Faculty timetable and pending grades |
| `ParentDashboardPage` | `/dashboard` (Student) | `GET /dashboard/parent`, `GET /results/me`, `GET /timetable/my-class`, `GET /notices` | Student | Student personal schedule, marks, notices |
| `AdmissionsQueuePage` | `/admissions` | `GET /admissions`, `PUT /admissions/{id}/status`, `DELETE /admissions/{id}`, `GET /admissions/documents/{id}/download`, `GET /admissions/export` | Principal | Application review & enrollment queue |
| `StudentsListPage` | `/students` | `GET /students`, `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}`, `POST /students/{id}/reset-password`, `GET /students/export`, `GET /classes` | Principal | Student directory; displays passwords to admin |
| `TeachersListPage` | `/teachers` | `GET /teachers`, `POST /teachers`, `PUT /teachers/{id}`, `DELETE /teachers/{id}`, `POST /teachers/{id}/reset-password`, `POST /teachers/{id}/allocations`, `DELETE /teachers/{id}/allocations/{id}`, `GET /teacher-attendance`, `POST /teacher-attendance` | Principal | Faculty management & daily attendance |
| `ClassesPage` | `/classes` | `GET /classes`, `POST /classes`, `PUT /classes/{id}`, `DELETE /classes/{id}`, `GET /academic-years`, `GET /subjects`, `POST /classes/{id}/subjects`, `POST /classes/{id}/subjects/{id}/teacher` | Principal | Classrooms, subjects & teacher assignments |
| `TimetablePage` | `/timetable` | `GET /timetable/class/{id}`, `GET /timetable/my-class`, `POST /timetable`, `DELETE /timetable/{id}`, `GET /timetable/academic-year/{id}/status`, `POST /timetable/academic-year/{id}/fix` | All Roles | Timetable schedule grid (locked for students) |
| `MarkAttendancePage` | `/attendance` | `GET /attendance/class/{id}`, `POST /attendance/mark`, `GET /attendance/low-attendance`, `GET /classes` | Principal, Teacher | Daily classroom attendance recording |
| `ExamsListPage` | `/exams` | `GET /exams`, `POST /exams`, `PUT /exams/{id}`, `DELETE /exams/{id}`, `POST /exams/{id}/publish`, `GET /results/me`, `GET /classes` | All Roles | Exam schedules; students view drill-down marks |
| `MarksEntryPage` | `/exams/marks` | `GET /exams`, `GET /exams/{id}/marks/{subjectId}`, `POST /exams/{id}/marks`, `GET /classes` | Teacher | Faculty marks entry grid |
| `ResultsViewPage` | `/exams/results` | `GET /exams`, `GET /results/exam/{id}/class-report`, `GET /results/{examId}/report-card/{studentId}`, `GET /results/exam/{id}/export-csv` | Principal, Teacher | Exam performance rankings & CSV export |
| `FeeManagementPage` | `/fees` | `GET /fees/student/{id}`, `POST /fees/payments`, `POST /fees/payments/bulk`, `GET /fee-structures`, `POST /fee-structures`, `GET /fee-heads`, `POST /fee-heads`, `GET /fees/reports/collection` | Principal | Fee structure setup & payment recording |
| `FeeDefaultersPage` | `/fees/defaulters` | `GET /fees/reports/defaulters`, `GET /fees/reports/defaulters/export`, `GET /classes` | Principal | Overdue balance accounts |
| `NoticesPage` | `/notices` | `GET /notices`, `POST /notices`, `DELETE /notices/{id}`, `GET /classes` | All Roles | Campus official circulars & noticeboard |
| `UsersPage` | `/admin/users` | `GET /users`, `POST /users`, `PUT /users/{id}/status`, `PUT /users/{id}/roles`, `PUT /users/{id}/reset-password` | Principal | System accounts administration |
| `AuditLogsPage` | `/admin/audit-logs` | `GET /audit-logs` | Principal | System audit trail viewer |

---

### Responsiveness & Mobile Screen Fragility

- **CSS Implementation:** Tailwind CSS utility classes. Viewport meta tag is present in `index.html` (`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`).
- **High-Risk Mobile Breakage (320px–375px screens):**
  1. **`TimetablePage.tsx`:** Renders an 8-period horizontal table. On screens <400px, headers overlap or force extreme horizontal scrolling without vertical stacking.
  2. **`MarksEntryPage.tsx`:** Score entry spreadsheet contains student roll number, student name, score input, absent checkbox, and remarks on a single line. On mobile devices, inputs collapse or clip.
  3. **`ClassesPage.tsx`:** Teacher allocation modal contains split 2-column flex containers that cause vertical overlap on narrow screens.
  4. **`FeeManagementPage.tsx`:** Bulk payment modal contains nested itemized tables that cause horizontal overflow on mobile viewports.

---

### TypeScript Build Status (`npm run build`)

Running `npm run build` currently **FAILS** with 3 compile-time errors:
- Command: `tsc -b && vite build`
- Exit Code: `1`
- Errors:
  ```
  src/pages/dashboards/ParentDashboardPage.tsx(178,93): error TS2339: Property 'classRoomId' does not exist on type 'ParentStudentDashboardData'.
  src/pages/dashboards/ParentDashboardPage.tsx(180,65): error TS2339: Property 'classRoomId' does not exist on type 'ParentStudentDashboardData'.
  src/pages/dashboards/ParentDashboardPage.tsx(183,63): error TS2339: Property 'classRoomId' does not exist on type 'ParentStudentDashboardData'.
  ```

---

## 6. Configuration and secrets

### Complete Configuration Keys Inventory

| Config Key | File Path | Secret? | Redacted Value / Placeholder | Committed in Repo? | Nature |
|---|---|---|---|---|---|
| `ConnectionStrings:DefaultConnection` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | Yes | `Host=localhost;Port=5432;Database=institution_erp;Username=postgres;Password=<REDACTED>;` | **Yes** | Real-looking local DB credential |
| `Jwt:Secret` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | Yes | `<REDACTED>` | **Yes** | Real-looking static 72-byte key |
| `Jwt:Issuer` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `InstitutionErp` | **Yes** | Config string |
| `Jwt:Audience` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `InstitutionErpApp` | **Yes** | Config string |
| `Jwt:ExpiryMinutes` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `15` | **Yes** | Numeric value |
| `Admin:Email` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `admin@gmail.com` | **Yes** | Seed account identity |
| `Admin:Password` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | Yes | `<REDACTED>` | **Yes** | Real-looking cleartext seed password |
| `Smtp:Host` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `localhost` | **Yes** | Local MailHog host |
| `Smtp:Port` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `1025` | **Yes** | Local MailHog port |
| `Smtp:From` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `erp@institution.edu` | **Yes** | Sender email |
| `Storage:BasePath` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `uploads` | **Yes** | Directory path |
| `Payment:Razorpay:Enabled` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `false` | **Yes** | Feature flag |
| `Payment:Razorpay:KeyId` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | Yes | `<REDACTED>` | **Yes** | Placeholder (`rzp_test_placeholder`) |
| `Payment:Razorpay:KeySecret` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | Yes | `<REDACTED>` | **Yes** | Placeholder (`test_secret_key`) |
| `AllowedHosts` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.json` | No | `*` | **Yes** | Wildcard allowed hosts |
| `Logging:LogLevel:Default` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.Development.json` | No | `Information` | **Yes** | Logging level |
| `Logging:LogLevel:Microsoft.AspNetCore` | `institution-erp/backend/src/InstitutionErp.Api/appsettings.Development.json` | No | `Warning` | **Yes** | Logging level |
| `POSTGRES_DB` | `institution-erp/.env.example` | No | `institution_erp` | **Yes** | Database name |
| `POSTGRES_USER` | `institution-erp/.env.example` | No | `postgres` | **Yes** | Username |
| `POSTGRES_PASSWORD` | `institution-erp/.env.example` | Yes | `<REDACTED>` | **Yes** | Placeholder (`root`) |
| `POSTGRES_PORT` | `institution-erp/.env.example` | No | `5432` | **Yes** | Port |
| `CONNECTION_STRING` | `institution-erp/.env.example` | Yes | `Host=localhost;Port=5432;Database=institution_erp;Username=postgres;Password=<REDACTED>` | **Yes** | Sample connection string |
| `JWT_SECRET` | `institution-erp/.env.example` | Yes | `<REDACTED>` | **Yes** | Placeholder key |
| `VITE_API_URL` | `institution-erp/.env.example` | No | `http://localhost:5050/api/v1` | **Yes** | Local API URL |
| `ConnectionStrings__DefaultConnection` | `institution-erp/docker-compose.yml` | Yes | `Host=postgres;Port=5432;Database=institution_erp;Username=postgres;Password=<REDACTED>` | **Yes** | Container connection string |
| `Jwt__Secret` | `institution-erp/docker-compose.yml` | Yes | `<REDACTED>` | **Yes** | Hardcoded production env secret |

---

### Hardcoded Values in Code

1. **`Program.cs:L39` & `JwtTokenService.cs:L23`:** Fallback JWT secret hardcoded in C# string: `<REDACTED>`.
2. **`Program.cs:L83-88`:** Hardcoded CORS allowed origins: `"http://localhost:3000"`, `"http://localhost:5173"`, `"http://127.0.0.1:3000"`, `"http://127.0.0.1:5173"`.
3. **`DependencyInjection.cs:L21`:** Fallback connection string hardcoded in C# string: `Host=localhost;Port=5432;Database=institution_erp;Username=postgres;Password=<REDACTED>;`.
4. **`DatabaseSeeder.cs:L51-54`:** Fallback admin email `"admin@institution.local"`, fallback password `<REDACTED>`, fallback name `"System"`, `"Administrator"`.
5. **`RazorpayPaymentGateway.cs:L44`:** Fallback Razorpay secret hardcoded in C# string: `<REDACTED>`.
6. **`NotificationServices.cs:L71`:** Fallback sender email `"erp@institution.edu"`.
7. **`AdmissionsController.cs:L556`:** Magic number `100` hardcoded as starting student roll number.
8. **`vite.config.ts:L11`:** Hardcoded dev proxy target: `"http://localhost:5050"`.
9. **`nginx.conf:L21`:** Hardcoded Docker internal proxy target: `http://backend:5050/api/`.

---

### Production Hardening Readiness

- **Swagger in Production:** **Enabled**. `Program.cs` calls `app.UseSwagger()` without an `app.Environment.IsDevelopment()` check.
- **HTTPS Redirection / HSTS:** **Disabled**. `UseHttpsRedirection()` and `UseHsts()` are completely absent from `Program.cs`. `SecurityHeadersMiddleware.cs` only appends HSTS if `context.Request.IsHttps == true`.
- **Security Headers:** Partial. `SecurityHeadersMiddleware.cs` appends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. CSP (`Content-Security-Policy`) is **not configured**.
- **Forwarded Headers:** **Disabled**. Not registered in `Program.cs`. When deployed behind Nginx, Cloudflare, or AWS ALB, client IP resolution will fail or report reverse proxy IP.

---

## 7. Build, run, deploy state

### Commands to Build and Run Locally

#### Backend (.NET 8):
```powershell
# Restore & Build
cd "d:\CLG APP\institution-erp\backend"
dotnet build InstitutionErp.sln

# Run API (Listens on port 5050)
dotnet run --project "src/InstitutionErp.Api/InstitutionErp.Api.csproj" --urls "http://localhost:5050"
```

#### Frontend (Vite + React):
```powershell
cd "d:\CLG APP\institution-erp\frontend"
npm install
npm run dev
# Listens on http://localhost:3000
```

---

### Deployment Configuration Files

#### 1. Backend Dockerfile ([institution-erp/backend/Dockerfile](file:///d:/CLG%20APP/institution-erp/backend/Dockerfile))
Multi-stage build using `mcr.microsoft.com/dotnet/sdk:8.0` for compilation and `mcr.microsoft.com/dotnet/aspnet:8.0` for runtime. Installs `fontconfig` and `fonts-dejavu-core` for QuestPDF report generation. Exposes port `5050`.

#### 2. Frontend Dockerfile ([institution-erp/frontend/Dockerfile](file:///d:/CLG%20APP/institution-erp/frontend/Dockerfile))
Multi-stage build using `node:20-alpine` (`npm run build`) and `nginx:alpine` runtime. Exposes port `80`.

#### 3. Docker Compose ([institution-erp/docker-compose.yml](file:///d:/CLG%20APP/institution-erp/docker-compose.yml))
Orchestrates 3 containers:
- `postgres`: `postgres:16-alpine`, port 5432, volume `postgres_data`.
- `backend`: builds `./backend`, port 5050, depends on healthy postgres.
- `frontend`: builds `./frontend`, port 3000 -> container port 80.
- CI/CD pipelines (GitHub Actions, GitLab CI): **NOT FOUND**.
- Deployment manifests (`render.yaml`, `vercel.json`): **NOT FOUND**.

---

### Build & Audit Command Results

1. **`dotnet build InstitutionErp.sln`:**
   - Standalone projects (`Domain`, `Application`, `UnitTests`) build cleanly with 0 errors.
   - Building the full solution while the API daemon is running produces file locking errors (`MSB3021 / MSB3027`) because `InstitutionErp.Api.dll` is actively in use by PID 5480.
2. **`dotnet test (UnitTests)`:**
   - **Passed:** 23 tests passed, 0 failed, 0 skipped in 296ms.
3. **`dotnet test (IntegrationTests)`:**
   - **0 tests executed** (project contains 0 test files).
4. **`dotnet list package --vulnerable`:**
   - Found **2 known moderate vulnerabilities**:
     - `warning NU1902: Package 'MailKit' 4.7.1 has a known moderate severity vulnerability (GHSA-9j88-vvj5-vhgr)`
     - `warning NU1902: Package 'MimeKit' 4.7.1 has a known moderate severity vulnerability (GHSA-g7hc-96xr-gvvx)`
5. **`npm audit`:**
   - Found **7 vulnerabilities** (5 High, 2 Moderate) in frontend dependencies:
     - `braces` (High - Stack exhaustion DoS) via `chokidar`/`tailwindcss`.
     - `postcss-selector-parser` (Moderate - Quadratic complexity CPU exhaustion) via `tailwindcss`.
6. **API Specifications:**
   - Solution File: `d:\CLG APP\institution-erp\backend\InstitutionErp.sln`
   - API Project: `d:\CLG APP\institution-erp\backend\src\InstitutionErp.Api\InstitutionErp.Api.csproj`
   - Active Local Port: `http://localhost:5050`
   - Health Check Endpoint: `http://localhost:5050/health` (built-in ASP.NET check) and `http://localhost:5050/api/v1/health` (custom HealthController).

---

## 8. Data and features at risk

### User Data State

The active PostgreSQL database contains **only synthetic test and seed accounts** (10 user rows: `admin@gmail.com`, `amit@gmail.com`, `komal@gmail.com`, `priti@gmail.com`, `diksha@gmail.com`, etc. with dummy phone numbers such as `5555555555` and `4444444444`). There is **no evidence of real production student or faculty data** currently residing in the database.

---

### Incomplete, Stubbed, or Broken Features

1. **Broken Frontend Production Build:** `ParentDashboardPage.tsx` accesses `.classRoomId` which does not exist on type `ParentStudentDashboardData`. Running `npm run build` halts with exit code 1.
2. **Unused FluentValidation Layer:** 7 validator classes are registered in DI, but never executed because `FluentValidation.AspNetCore` is missing and validators are not injected into controllers.
3. **Dummy SMS & WhatsApp Notification Channels:** Both `SmsNotificationChannel` and `WhatsAppNotificationChannel` are stubbed `Task.FromResult(true)` that print to log output without contacting external telecommunication gateways.
4. **Mocked Payment Verification:** `RazorpayPaymentGateway` bypasses signature checking when `Payment:Razorpay:Enabled` is false (the default setting), accepting arbitrary strings as valid payment receipts.
5. **Orphaned Backend Endpoint:** `POST /api/v1/fees/online/create-order` is defined on the backend but is never referenced or called by the frontend.
6. **Incomplete Integration Test Suite:** `InstitutionErp.IntegrationTests.csproj` exists in the solution but contains zero test files.

---

## 9. Top-20 risk list

| Rank | Severity | File Path | Risk / Problem Description | Operational & Security Impact |
|---|---|---|---|---|
| **1** | **Critical** | [DatabaseSeeder.cs:L80-93](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Seeding/DatabaseSeeder.cs#L80-L93) | **Admin Password Reverted on Every Restart:** If the admin user already exists, the seeder resets their password hash back to `Admin:Password` from configuration on every application reboot. | If an administrator changes their password to secure the system, restarting the server silently overwrites their password back to the default repo credential. |
| **2** | **Critical** | [StudentControllers.cs:L124,L253](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L124), [TeacherControllers.cs:L63,L127](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/TeacherControllers.cs#L63) | **Plaintext Passwords Stored & Leaked via API:** User passwords are stored in cleartext in `users.default_password` and serialized across the wire in `StudentDto` and `TeacherDto`. | Anyone with admin or API read access receives cleartext passwords for all students and faculty in the institution. |
| **3** | **Critical** | [appsettings.json:L6,L13](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/appsettings.json#L6), [docker-compose.yml:L34](file:///d:/CLG%20APP/institution-erp/backend/docker-compose.yml#L34) | **Committed Production Secrets & Static Keys:** Production JWT secret keys, database connection strings, and admin credentials are committed directly into the Git repository. | Anyone with read access to the Git repository can forge valid administrator JWT tokens and access database tables directly. |
| **4** | **Critical** | [ParentDashboardPage.tsx:L178-183](file:///d:/CLG%20APP/institution-erp/frontend/src/pages/dashboards/ParentDashboardPage.tsx#L178-L183) | **Broken Frontend Production Build:** TypeScript compilation failure (`Property 'classRoomId' does not exist on type 'ParentStudentDashboardData'`) halts `npm run build`. | Deployment pipelines and Docker container builds will fail immediately during the frontend build step. |
| **5** | **Critical** | [Program.cs:L163](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L163) | **Absence of EF Core Migrations (`EnsureCreatedAsync`):** The application relies on `EnsureCreatedAsync()` instead of EF Core migrations, with manual `ALTER TABLE` execution in `try...catch`. | Schema changes cannot be tracked, migrated, or rolled back in production. `EnsureCreatedAsync` will not update existing tables when entities change. |
| **6** | **High** | [StudentControllers.cs:L76-95](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L76-L95) | **Student Directory Authorization Bypass (Fail Open):** `GET /api/v1/students` only restricts teachers; students fall through the conditional check and receive all student records. | Any authenticated student can dump the entire student body roster, home addresses, phone numbers, and guardian details. |
| **7** | **High** | [AttendanceController.cs:L153-163](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AttendanceController.cs#L153-L163) | **Attendance Scoping Authorization Bypass:** `GET /api/v1/attendance/class/{classId}` only validates teacher allocation; student calls bypass the filter. | Any student can view daily attendance sheets and absence records for all classrooms and cohorts. |
| **8** | **High** | [FeeControllers.cs:L459-469](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/FeeControllers.cs#L459-L469) | **Financial Data Access Control Bypass:** `GET /api/v1/fees/student/{studentId}` only scopes students and parents; faculty calls fall through unconstrained. | Any teacher can view private billing invoices, payment modes, and outstanding balances of any student in the school. |
| **9** | **High** | [NotificationServices.cs:L87-91](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Notifications/NotificationServices.cs#L87-L91) | **Silent Delivery Failure on SMTP Errors:** `EmailNotificationChannel` catches exceptions and returns `true`, marking failed emails as `Sent` in the database outbox. | When the SMTP relay is down, admission credential emails, password reset codes, and absence notices are permanently lost without retry. |
| **10** | **High** | [Program.cs:L11-15](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Application/DependencyInjection.cs#L11-L15) | **Dormant Validation Layer:** FluentValidation validators in `AppValidators.cs` are registered in DI but never hooked into the ASP.NET Core pipeline or controllers. | Malformed, negative, or over-length strings bypass validation unless manually caught by ad-hoc `if` checks in controllers. |
| **11** | **High** | [AdmissionsController.cs:L161-164](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L161-L164) | **Unauthenticated File Upload & PDF Spoofing:** `POST /api/v1/admissions/{id}/documents` allows anonymous uploads and checks only file extension without verifying PDF magic bytes. | Attackers can flood the server's disk storage with malicious or oversized files masquerading as PDFs. |
| **12** | **High** | [AdmissionsController.cs:L48-69](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L48-L69), [StudentControllers.cs:L272-294](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L272-L294) | **Race Condition on Registration Numbering:** Sequential registration numbers are calculated via in-memory loops and `while(AnyAsync)` checks rather than DB sequences. | Concurrent admission approvals or student creations will generate duplicate registration numbers or trigger primary key conflicts. |
| **13** | **Medium** | [AdmissionsController.cs:L385-640](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/AdmissionsController.cs#L385-L640), [StudentControllers.cs:L301-340](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/StudentControllers.cs#L301-L340) | **Missing Database Transactions:** Multi-entity operations execute multiple `SaveChangesAsync()` calls sequentially without an overarching `IDbContextTransaction`. | Network or runtime failures midway through enrollment create orphaned users without corresponding student records or fee ledgers. |
| **14** | **Medium** | [RazorpayPaymentGateway.cs:L38-42](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Infrastructure/Payment/RazorpayPaymentGateway.cs#L38-L42) | **Unchecked Payment Verification Fallback:** When Razorpay is disabled in config, `VerifySignature` returns `true` for all submitted signatures. | Any user can spoof payment receipts and clear tuition fee debts by submitting arbitrary transaction strings. |
| **15** | **Medium** | [Program.cs:L186-191](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L186-L191) | **Unconditional Swagger Exposure:** Swagger UI and OpenAPI JSON endpoints are enabled in all environments, including production. | Attackers can map the entire API surface, payload contracts, and controller routes. |
| **16** | **Medium** | [Program.cs:L96-106](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L96-L106) | **Inactive Rate Limiting on Login:** The `auth-limit` rate limiter is registered in DI but never mapped via `[EnableRateLimiting]` to `AuthController`. | Attackers can launch automated credential stuffing and brute-force attacks against the login endpoint. |
| **17** | **Medium** | [Program.cs:L50-51](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Program.cs#L50-L51) | **Missing HTTPS Redirection & HSTS:** `UseHttpsRedirection()` and `UseHsts()` are omitted from the ASP.NET pipeline, and `RequireHttpsMetadata = false` is configured on JWT Bearer. | Unencrypted HTTP traffic allows tokens and credentials to be intercepted in transit if SSL termination is misconfigured. |
| **18** | **Medium** | [frontend/src/store/authContext.tsx:L38-40](file:///d:/CLG%20APP/institution-erp/frontend/src/store/authContext.tsx#L38-L40) | **JWT Access and Refresh Tokens in `localStorage`:** Tokens are stored in browser `localStorage` instead of HttpOnly, SameSite cookies. | Any client-side XSS vulnerability permits complete session hijacking and token theft. |
| **19** | **Low** | [ExamControllers.cs:L83](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Controllers/ExamControllers.cs#L83) | **In-Memory Table Scanning:** `GetExams` queries the entire `TeacherAllocations` table into memory on every request to compute faculty permissions via LINQ. | Causes severe CPU spikes and memory exhaustion as faculty allocations scale in production. |
| **20** | **Low** | [ExceptionHandlingMiddleware.cs:L57](file:///d:/CLG%20APP/institution-erp/backend/src/InstitutionErp.Api/Middleware/ExceptionHandlingMiddleware.cs#L57) | **Detailed Internal Exception Message Exposure:** `Detail = exception.Message` is returned directly to API callers on unhandled errors. | Exposes database table names, constraint definitions, connection parameters, and file system paths to end users. |

---

## 10. Open questions & decisions for the project owner

1. **Password Storage & Transmission:** Should the `default_password` column and cleartext password serialization in DTOs be completely purged in favor of an industry-standard one-time temporary link / secure reset token pattern?
2. **Database Migration Strategy:** How should existing database schemas be baselined into official EF Core Migrations (`dotnet ef migrations add InitialBaseline`) so that future schema updates do not rely on fragile `EnsureCreatedAsync()` and runtime `ALTER TABLE` raw SQL?
3. **Parent Portal Architectural Model:** Should `Parent` be formalized as an official enum value in `UserRoleType` with distinct role policies and authentication records, rather than relying on matching `GuardianEmail` against user records?
4. **Production Secret Management:** What secret management provider (e.g. AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, or environment variable injection via Kubernetes secrets) will be used to replace the committed secrets in `appsettings.json` and `docker-compose.yml`?
5. **Payment Gateway Integration:** Is an active merchant Razorpay account or alternative payment gateway (Stripe, BillDesk) required for production, and should mock payment verification fallbacks be strictly stripped from production builds?
6. **External Notification Infrastructure:** Which production SMTP relay (SendGrid, AWS SES, Mailgun) and SMS provider (Twilio, MSG91) should be integrated to replace the current local MailHog and stubbed notification channels?
7. **Production Storage:** Should uploaded admission documents (PDFs) and generated report cards continue to be stored on local container disk volumes, or should an object storage provider (AWS S3, Google Cloud Storage, Azure Blob Storage) be introduced?
8. **Frontend Build Remediation:** Should the missing property `classRoomId` on `ParentStudentDashboardData` in `ParentDashboardPage.tsx` be updated to reference the student's enrolled cohort so that `npm run build` succeeds cleanly?