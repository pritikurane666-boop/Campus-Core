# CampusCore (institution-erp) — Code Cleanup & Deletion Candidates Log

**Branch:** `prod-hardening`  
**Status:** Verification Baseline Established (Deletions Scheduled for Phase 5)

This document catalogs every item identified for safe removal, including the exact file path, description, rationale, and proof of non-use. No items are deleted during Phase 0.

---

## 1. Safe-Removal Protocol

1. **Proof Before Deletion:** Every candidate must have verified proof of zero references via regex/search across both backend and frontend, and confirm no usage in DI, reflection, EF Core configurations, or routing.
2. **Atomic Commits:** Cleanups must be executed in small, isolated units with a dedicated git commit message.
3. **Continuous Verification:** After every cleanup unit, execute:
   - Backend: `dotnet build` (0 warnings), `dotnet test`
   - Frontend: `npm run build` (0 errors), `npm run lint`

---

## 2. Backend Deletion Candidates

| ID | Category | Target File & Symbol | Evidence & Proof | Status |
|---|---|---|---|---|
| **CLN-B01** | Dead Role | `Program.cs`: Legacy role policies | `UserRoleType` domain enum only has `Principal`, `Teacher`, `Student`. | **CLEANED (Phase 5)**: Standardized to canonical roles. |
| **CLN-B02** | Dead Role Seeding | `DatabaseSeeder.cs`: Seeding roles | Only `Principal`, `Teacher`, `Student` exist in domain enum. | **CLEANED (Phase 3/5)**: Seeder only iterates `UserRoleType` values. |
| **CLN-B03** | Plaintext Password Storage | `User.cs`: `DefaultPassword` | Storing plaintext passwords violates fundamental security standards. | **CLEANED (Phase 2)**: Dropped property & schema column. |
| **CLN-B04** | Runtime ALTER TABLE | `Program.cs`: `ALTER TABLE users ADD COLUMN default_password` | Hacky startup schema manipulation; replaced by standard EF migrations. | **CLEANED (Phase 3)**: Removed raw DDL. |
| **CLN-B05** | Insecure Formula Methods | `PasswordGenerator.cs`: Formula methods | Predictable passwords based on public attributes. | **CLEANED (Phase 2)**: Replaced with CSPRNG generator. |
| **CLN-B06** | Insecure Auth Fallbacks | `AuthController.cs`: Fallback comparisons | Bypassed BCrypt and allowed credential stuffing. | **CLEANED (Phase 2)**: Enforced strict BCrypt verification only. |
| **CLN-B07** | Hardcoded Fallback Secrets | `JwtTokenService.cs`: Fallback secret string | Token forgery risk if env var missing. | **CLEANED (Phase 1)**: Strict configuration startup validation. |
| **CLN-B08** | Hardcoded Connection String | `DependencyInjection.cs`: Fallback connection string | Hardcoded fallback connection string. | **CLEANED (Phase 1)**: Enforced required configuration. |
| **CLN-B09** | Hardcoded Razorpay Secret | `RazorpayPaymentGateway.cs`: Fallback secret | Fallback HMAC key. | **CLEANED (Phase 1)**: Fails closed when disabled. |
| **CLN-B10** | Plaintext Password DTO Fields | `StudentDto.cs`, `TeacherDto.cs`: `GeneratedPassword` | Serializes stored passwords over public GET endpoints. | **CLEANED (Phase 2)**: Removed from all GET DTOs. |
| **CLN-B11** | Dead Role Strings | Multiple controllers: `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | `SuperAdmin` and `Admin` roles do not exist in domain model. | **CLEANED (Phase 5)**: Standardized all controllers to `Roles = "Principal"`, `Roles = "Principal,Teacher"`, and `Roles = "Principal,Teacher,Student"`. |
| **CLN-B12** | Redundant Health Endpoint | Duplicate health endpoint | Handled via standard ASP.NET Core `/health` middleware. | **CLEANED (Phase 4)**: Standardized to `MapHealthChecks("/health")`. |
| **CLN-B13** | Duplicate Deallocate Route | `TeacherControllers.cs`: `[HttpDelete("allocations/{allocationId}")]` | Both routes protected by `Principal` authorization. | **CLEANED (Phase 5)**: Secured with `[Authorize(Roles = "Principal")]`. |

---

## 3. Frontend Deletion Candidates

| ID | Category | Target File & Symbol | Evidence & Proof | Status |
|---|---|---|---|---|
| **CLN-F01** | Broken Dashboard Prop | `ParentDashboardPage.tsx`: `data?.classRoomId` | Missing property caused `npm run build` failure. | **CLEANED (Phase 4/5)**: Aligned contract on backend DTO and frontend interface. |
| **CLN-F02** | Visible Password Columns | `StudentsListPage.tsx` & `TeachersListPage.tsx`: `Default Password` table column | Plaintext password display. | Targeted in Phase 6. |
| **CLN-F03** | Dead Parent Dispatches | `AppRoutes.tsx`: Role dispatcher | Redundant dispatchers. | **CLEANED (Phase 5)**: Cleaned dead role checks. |
| **CLN-F04** | Hardcoded Demo Credentials | `LoginPage.tsx`: Demo account cards | Sample credentials in UI. | Targeted in Phase 6. |
| **CLN-F05** | Unused Legacy CSS | `frontend/src/App.css` | Leftover styles from Vite boilerplate. | **CLEANED (Phase 5)**: Deleted unreferenced `App.css`. |
| **CLN-F06** | Hardcoded Console Logs | Frontend components: `console.log(...)` | Production hygiene. | Targeted in Phase 6. |

---

## 4. Protected Non-Code Files (Do Not Delete Without Explicit Approval)

The following files are preserved and will not be deleted without explicit approval:
- `antigravity_prompt_institution_erp.md` (Project requirement specification)
- `runall.ps1` & `runall.bat` (Local orchestration scripts)
- `docs/er-diagram.md` (Schema documentation; to be updated to reflect cleaned schema)
