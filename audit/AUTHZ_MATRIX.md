# CampusCore (institution-erp) — Authorization Matrix (AUTHZ_MATRIX.md)

**Branch:** `prod-hardening`  
**Status:** Canonical Role Authorization Specification (Phase 0 Baseline)

This document establishes the exhaustive Authorization Matrix for all 120 endpoints across the 22 controllers of CampusCore.
Roles evaluated:
1. **Anonymous (Anon)**: Unauthenticated visitor / public client.
2. **Student**: Enrolled student user.
3. **Teacher**: Faculty / class teacher user.
4. **Principal**: Institution Administrator.

---

## 1. Authorization Rules & Scoping Standards

- **Deny by Default:** Unless an endpoint is explicitly decorated with `[AllowAnonymous]`, all unauthenticated requests MUST yield **HTTP 401 Unauthorized**.
- **Role Ineligibility:** Authenticated users whose role does not satisfy the endpoint's policy MUST yield **HTTP 403 Forbidden**.
- **Data Scoping Rules:**
  - **Student Scoping:** A student may NEVER view, edit, or list records of other students. Any query returning student records MUST be restricted strictly to the current authenticated student's record (`UserId == currentUserId`). Accessing another student's ID must yield **HTTP 403 Forbidden** (or **404 Not Found** to prevent ID enumeration).
  - **Teacher Scoping:** A teacher may only enter marks, take attendance, or view student rosters for classes/subjects to which they are explicitly allocated via `TeacherAllocation` or `ClassRoom.ClassTeacherId`. Any attempt to access other classes must yield **HTTP 403 Forbidden**.
  - **Principal Scoping:** Full institution-wide administrative access.
- **Fail-Open Elimination:** All conditional checks such as `if (User.IsInRole("Teacher")) { ... }` that lack an explicit `else` branch rejecting unauthorized roles must be replaced with strict policy requirements and authorization handlers.

---

## 2. Exhaustive Endpoint Authorization Matrix

### Module 1: Academic Structure (`AcademicControllers.cs`)
Controllers: `AcademicYearsController`, `ClassesController`, `SubjectsController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 1 | `GET api/v1/academic-years` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Read-only listing of institution terms/years. |
| 2 | `POST api/v1/academic-years` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Policy: `PrincipalOnly`. |
| 3 | `PUT api/v1/academic-years/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. Remove dead roles. |
| 4 | `DELETE api/v1/academic-years/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. Soft delete. |
| 5 | `GET api/v1/classes` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Read-only list of classes for dropdowns. |
| 6 | `GET api/v1/classes/{id}` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Students restricted to own class info only. |
| 7 | `POST api/v1/classes` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Policy: `PrincipalOnly`. |
| 8 | `PUT api/v1/classes/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 9 | `DELETE api/v1/classes/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. Soft delete. |
| 10 | `GET api/v1/classes/{id}/subjects` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Subjects taught in this class. |
| 11 | `POST api/v1/classes/{id}/subjects` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Assign subject to class. Policy: `PrincipalOnly`. |
| 12 | `POST api/v1/classes/{id}/subjects/{subjectId}/teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Assign teacher to subject. Policy: `PrincipalOnly`. |
| 13 | `DELETE api/v1/classes/{id}/subjects/{subjectId}/teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Deallocate teacher. Policy: `PrincipalOnly`. |
| 14 | `DELETE api/v1/classes/{id}/subjects/{subjectId}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Detach subject from class. Policy: `PrincipalOnly`. |
| 15 | `GET api/v1/classes/{id}/students` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | **CRITICAL FIX**: Students get 403. Teachers only if allocated to class. |
| 16 | `POST api/v1/classes/{id}/class-teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 17 | `DELETE api/v1/classes/{id}/class-teacher` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. |
| 18 | `GET api/v1/subjects` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Read-only subject catalog. |
| 19 | `GET api/v1/subjects/{id}` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Subject detail. |
| 20 | `POST api/v1/subjects` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Policy: `PrincipalOnly`. |
| 21 | `PUT api/v1/subjects/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 22 | `DELETE api/v1/subjects/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. Soft delete. |
| 23 | `GET api/v1/subjects/{id}/teachers` | `[Authorize]` | 401 / 200 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 / 200 | Teachers qualified for subject. |
| 24 | `POST api/v1/subjects/{id}/teachers` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |

---

### Module 2: Admissions & Applicants (`AdmissionsController.cs`)
Controller: `AdmissionsController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 25 | `POST api/v1/admissions/apply` | `[AllowAnonymous]` | 201 / 201 / 201 / 201 | Public / Anon | 201 / 400 / 400 / 201 | Rate limited; returns random secret for doc upload. |
| 26 | `GET api/v1/admissions/status/{referenceNumber}` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Public / Applicant | 200 / 200 / 200 / 200 | Minimal data only (status, stage); no PII leakage. |
| 27 | `GET api/v1/admissions` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. Queue review. |
| 28 | `GET api/v1/admissions/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. Detailed applicant file. |
| 29 | `POST api/v1/admissions/{id}/documents` | `[AllowAnonymous]` (Insecure!) | 200 / 200 / 200 / 200 | Applicant (With Secret) | 200 / 403 / 403 / 200 | Validate upload secret, `%PDF-` magic bytes, 5MB limit. |
| 30 | `GET api/v1/admissions/documents/{id}/download` | `[Authorize]` (Insecure!) | 401 / 200 (Fail Open!) / 200 / 200 | Principal Only | 401 / 403 / 403 / 200 | **CRITICAL FIX**: Restrict download strictly to Principal. |
| 31 | `PUT api/v1/admissions/{id}/status` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | When status=Approved, returns one-time credential slip. |
| 32 | `DELETE api/v1/admissions/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. |
| 33 | `GET api/v1/admissions/export` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | CSV export. Policy: `PrincipalOnly`. |

---

### Module 3: Attendance Management (`AttendanceController.cs`)
Controller: `AttendanceController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 34 | `POST api/v1/attendance/mark` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | 401 / 403 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | Teachers only mark classes where allocated. |
| 35 | `GET api/v1/attendance/class/{classRoomId}` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | **CRITICAL FIX**: Students get 403. Teachers only allocated classes. |
| 36 | `GET api/v1/attendance/student/{studentId}/summary` | `[Authorize]` | 401 / 200 / 200 / 200 | Student (Own), Faculty, Principal | 401 / 200 (Own) / 200 (Allocated) / 200 | Students restricted to their own `studentId`. |
| 37 | `GET api/v1/attendance/low-attendance` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | 401 / 403 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | Defaulters report scoped to allocated classes. |

---

### Module 4: Authentication & Session (`AuthController.cs`)
Controller: `AuthController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 38 | `POST api/v1/auth/login` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Public / Anon | 200 / 200 / 200 / 200 | Rate limited; BCrypt verification only; sets HttpOnly cookie. |
| 39 | `POST api/v1/auth/refresh` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Authenticated Cookie | 200 / 200 / 200 / 200 | Rate limited; token rotation; reuse detection revokes all tokens. |
| 40 | `POST api/v1/auth/logout` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Revokes refresh token and clears cookie. |
| 41 | `POST api/v1/auth/change-password` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Clears `MustChangePassword`; revokes all existing refresh tokens. |
| 42 | `POST api/v1/auth/forgot-password` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Public / Anon | 200 / 200 / 200 / 200 | Rate limited; returns identical message if user exists or not. |
| 43 | `POST api/v1/auth/reset-password` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Public / Anon | 200 / 200 / 200 / 200 | Rate limited; single-use hashed token with 15m expiry. |
| 44 | `GET api/v1/auth/me` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Returns current user profile without password fields. |

---

### Module 5: Exams & Results (`ExamControllers.cs`)
Controllers: `ExamsController`, `ResultsController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 45 | `GET api/v1/exams` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Own Class) / 200 (Allocated) / 200 | Students only view exams for their class; unpublished hidden. |
| 46 | `GET api/v1/exams/{id}` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Own Class) / 200 (Allocated) / 200 | Scoped to student class / teacher allocation. |
| 47 | `POST api/v1/exams` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Policy: `PrincipalOnly`. |
| 48 | `PUT api/v1/exams/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 49 | `DELETE api/v1/exams/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. Soft delete. |
| 50 | `GET api/v1/exams/{id}/marks/{examSubjectId}` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | **CRITICAL FIX**: Students get 403. Teacher only allocated subject. |
| 51 | `POST api/v1/exams/{id}/marks` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Allocated Teacher & Principal | 401 / 403 / 200 (Allocated) / 200 | **CRITICAL FIX**: Verify teacher is allocated to subject; else 403. |
| 52 | `POST api/v1/exams/{id}/publish` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. Marks become visible to students. |
| 53 | `GET api/v1/results/me` | `[Authorize]` | 401 / 200 / 200 / 200 | Student Only | 401 / 200 / 403 / 403 | Returns marks for published exams only for current student. |
| 54 | `GET api/v1/results/student/{studentId}` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Student (Own), Faculty, Principal | 401 / 200 (Own) / 200 (Allocated) / 200 | Students restricted to their own `studentId`. |
| 55 | `GET api/v1/results/{examId}/report-card/{studentId}` | `[Authorize]` | 401 / 200 / 200 / 200 | Student (Own), Faculty, Principal | 401 / 200 (Own) / 200 (Allocated) / 200 | PDF stream. Students restricted to own ID. |
| 56 | `GET api/v1/results/exam/{examId}/class-report` | `[Authorize(Roles = "Principal,Teacher")]` | 401 / 403 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | Scoped to allocated class. |
| 57 | `GET api/v1/results/exam/{examId}/export-csv` | `[Authorize(Roles = "Principal,Teacher")]` | 401 / 403 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | Scoped to allocated class. |

---

### Module 6: Fee Management & Payments (`FeeControllers.cs`)
Controllers: `FeeStructuresController`, `FeeHeadsController`, `FeesController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 58 | `GET api/v1/fee-structures` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Own Class) / 200 / 200 | Fee structures for tuition tiers. |
| 59 | `POST api/v1/fee-structures` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Policy: `PrincipalOnly`. |
| 60 | `PUT api/v1/fee-structures/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 61 | `DELETE api/v1/fee-structures/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. |
| 62 | `GET api/v1/fee-heads` | `[Authorize]` | 401 / 200 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 / 200 | Fee line items (Library, Tuition, Lab). |
| 63 | `POST api/v1/fee-heads` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Policy: `PrincipalOnly`. |
| 64 | `PUT api/v1/fee-heads/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 65 | `DELETE api/v1/fee-heads/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. |
| 66 | `GET api/v1/fees/student/{studentId}` | `[Authorize]` | 401 / 200 / 200 (Fail Open!) / 200 | Student (Own) & Principal | 401 / 200 (Own) / 403 / 200 | **CRITICAL FIX**: Teachers get 403. Students only own `studentId`. |
| 67 | `POST api/v1/fees/payments` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Offline fee collection. Policy: `PrincipalOnly`. |
| 68 | `POST api/v1/fees/payments/bulk` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Multi-head payment. Policy: `PrincipalOnly`. |
| 69 | `GET api/v1/fees/payments/{paymentId}/receipt` | `[Authorize]` | 401 / 200 / 200 (Fail Open!) / 200 | Student (Own) & Principal | 401 / 200 (Own) / 403 / 200 | PDF receipt download. Scoped to payment owner. |
| 70 | `GET api/v1/fees/reports/collection` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Financial summaries. Policy: `PrincipalOnly`. |
| 71 | `GET api/v1/fees/reports/defaulters` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Unpaid dues report. Policy: `PrincipalOnly`. |
| 72 | `GET api/v1/fees/reports/defaulters/export` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | CSV export. Policy: `PrincipalOnly`. |
| 73 | `POST api/v1/fees/online/create-order` | `[Authorize]` | 401 / 200 / 200 / 200 | Disabled (Fail Closed) | 401 / 501 / 501 / 501 | Returns HTTP 501 / 404 when gateway disabled. |

---

### Module 7: Student Management (`StudentControllers.cs`)
Controllers: `StudentsController`, `ParentsController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 74 | `GET api/v1/students` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Allocated) / 200 | **CRITICAL FIX**: Students get 403. Teachers only allocated classes. |
| 75 | `GET api/v1/students/me` | `[Authorize]` | 401 / 200 / 404 / 404 | Student Only | 401 / 200 / 404 / 404 | Returns student profile of current user. |
| 76 | `GET api/v1/students/{id}` | `[Authorize]` | 401 / 200 (Fail Open!) / 200 / 200 | Student (Own), Faculty, Principal | 401 / 200 (Own) / 200 (Allocated) / 200 | Students restricted to own ID. |
| 77 | `POST api/v1/students` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Returns one-time credential slip. Policy: `PrincipalOnly`. |
| 78 | `POST api/v1/students/{id}/reset-password` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Generates CSPRNG temp password; returns once. |
| 79 | `PUT api/v1/students/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 80 | `DELETE api/v1/students/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Soft delete. Policy: `PrincipalOnly`. |
| 81 | `GET api/v1/students/export` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | CSV export. Policy: `PrincipalOnly`. |
| 82 | `GET api/v1/parents/my-children` | `[Authorize]` | 401 / 200 / 200 / 200 | Deprecated / Student Portal | 401 / 200 / 403 / 200 | Replaced by `/students/me`. |

---

### Module 8: System, Notices & Dashboards (`SystemControllers.cs`)
Controllers: `NoticesController`, `NotificationsController`, `DashboardController`, `AuditLogsController`, `HealthController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 83 | `GET api/v1/notices` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Scoped by `target_role` (Students see Student/All; Teachers see Teacher/All). |
| 84 | `POST api/v1/notices` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | 401 / 403 / 201 / 201 | Faculty & Principal | 401 / 403 / 201 / 201 | Faculty can publish class notices. |
| 85 | `DELETE api/v1/notices/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | 401 / 403 / 204 (Fail Open!) / 204 | Faculty (Own) & Principal | 401 / 403 / 204 (Own) / 204 | Teachers can only delete their own notices. |
| 86 | `GET api/v1/notifications` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Scoped strictly to current user (`user_id == currentUserId`). |
| 87 | `GET api/v1/notifications/unread-count` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Scoped to current user. |
| 88 | `PUT api/v1/notifications/{id}/read` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Own) / 200 (Own) / 200 | Must verify ownership before marking read. |
| 89 | `PUT api/v1/notifications/read-all` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Marks all notifications of current user read. |
| 90 | `GET api/v1/dashboard/admin` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. Institutional KPIs. |
| 91 | `GET api/v1/dashboard/accountant` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Fee overview. Policy: `PrincipalOnly`. |
| 92 | `GET api/v1/dashboard/teacher` | `[Authorize(Roles = "Principal,Teacher")]` | 401 / 403 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 / 200 | Faculty schedule and pending mark entry. |
| 93 | `GET api/v1/dashboard/student` | `[Authorize]` | 401 / 200 / 200 / 200 | Student Only | 401 / 200 / 403 / 403 | Student personal attendance and timetable. |
| 94 | `GET api/v1/dashboard/parent` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher,Student,Parent")]` | 401 / 200 / 200 / 200 | Student Only | 401 / 200 / 403 / 403 | Student portal dashboard; remove dead roles. |
| 95 | `GET api/v1/audit-logs` | `[Authorize(Roles = "Principal")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | System audit log. Policy: `PrincipalOnly`. |
| 96 | `GET api/v1/health` | **NONE** (Allows unauthenticated calls) | 200 / 200 / 200 / 200 | Deprecated | 404 / 404 / 404 / 404 | Remove; consolidate to root `/health`. |

---

### Module 9: Faculty & Timetable (`TeacherControllers.cs`)
Controllers: `TeachersController`, `TimetableController`, `TeacherAttendanceController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 97 | `GET api/v1/teachers` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Minimal) / 200 / 200 | Strip contact numbers and passwords for students. |
| 98 | `GET api/v1/teachers/{id}` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Minimal) / 200 / 200 | Minimal public profile for students. |
| 99 | `POST api/v1/teachers` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Generates temp password; returns once. Policy: `PrincipalOnly`. |
| 100 | `POST api/v1/teachers/{id}/reset-password` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Returns one-time credential slip. Policy: `PrincipalOnly`. |
| 101 | `PUT api/v1/teachers/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 102 | `DELETE api/v1/teachers/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Soft delete. Policy: `PrincipalOnly`. |
| 103 | `POST api/v1/teachers/{id}/allocations` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 104 | `DELETE api/v1/teachers/allocations/{allocationId}` | `[Authorize]` (Missing Role Attribute!) | 401 / 204 (CRITICAL VULN!) / 204 / 204 | Principal Only | 401 / 403 / 403 / 204 | **CRITICAL FIX**: Delete duplicate route or lock to Principal. |
| 105 | `DELETE api/v1/teachers/{id}/allocations/{allocationId}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 204 | Principal Only | 401 / 403 / 403 / 204 | Policy: `PrincipalOnly`. |
| 106 | `GET api/v1/timetable/my-class` | `[Authorize]` | 401 / 200 / 200 / 200 | Student & Faculty | 401 / 200 (Own Class) / 200 (Own Class) / 200 | Scoped strictly to caller's class. |
| 107 | `GET api/v1/timetable/class/{classId}` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 (Own Class) / 200 / 200 | Students restricted to viewing only their own class. |
| 108 | `GET api/v1/timetable/teacher/{teacherId}` | `[Authorize]` | 401 / 200 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Own) / 200 | Teacher schedule grid. |
| 109 | `GET api/v1/timetable/academic-year/{academicYearId}/status` | `[Authorize]` | 401 / 200 / 200 / 200 | All Roles | 401 / 200 / 200 / 200 | Draft vs Published timetable status. |
| 110 | `POST api/v1/timetable/academic-year/{academicYearId}/fix` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Locks and publishes timetable. Policy: `PrincipalOnly`. |
| 111 | `POST api/v1/timetable/academic-year/{academicYearId}/unfix` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Unlocks timetable. Policy: `PrincipalOnly`. |
| 112 | `POST api/v1/timetable` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | 401 / 403 / 201 / 201 | Faculty & Principal | 401 / 403 / 201 (Allocated) / 201 | Teachers only assign for allocated classes. |
| 113 | `DELETE api/v1/timetable/{id}` | `[Authorize(Roles = "Principal,SuperAdmin,Admin,Teacher")]` | 401 / 403 / 204 / 204 | Faculty & Principal | 401 / 403 / 204 (Allocated) / 204 | Teachers only delete own entries. |
| 114 | `GET api/v1/teacher-attendance` | `[Authorize]` | 401 / 200 / 200 / 200 | Faculty & Principal | 401 / 403 / 200 (Own) / 200 | Teachers only view own attendance; Principal all. |
| 115 | `POST api/v1/teacher-attendance` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |

---

### Module 10: User Administration (`UsersController.cs`)
Controller: `UsersController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 116 | `GET api/v1/users` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Policy: `PrincipalOnly`. |
| 117 | `POST api/v1/users` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 201 | Principal Only | 401 / 403 / 403 / 201 | Generates temp password; returns once. Policy: `PrincipalOnly`. |
| 118 | `PUT api/v1/users/{id}/status` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Activate/deactivate accounts. Policy: `PrincipalOnly`. |
| 119 | `PUT api/v1/users/{id}/reset-password` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Returns one-time credential slip. Policy: `PrincipalOnly`. |
| 120 | `PUT api/v1/users/{id}/roles` | `[Authorize(Roles = "Principal,SuperAdmin,Admin")]` | 401 / 403 / 403 / 200 | Principal Only | 401 / 403 / 403 / 200 | Assign roles from canonical set (`Principal`, `Teacher`, `Student`). |

---

### Module 11: Authentication & Two-Factor Authentication (`AuthController.cs`)
Controller: `AuthController`

| # | Method & Route | Current Auth Attribute | Current Behavior (Anon / Student / Teacher / Principal) | Intended Access | Expected Status (Anon / Student / Teacher / Principal) | Data Scoping & Hardening Rule |
|---|---|---|---|---|---|---|
| 121 | `POST api/v1/auth/login` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Public / Anonymous | 200 / 200 / 200 / 200 | Rate limited. If user has TOTP or required role without TOTP, returns challengeId instead of tokens. |
| 122 | `POST api/v1/auth/refresh` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Public (with Cookie) | 200 / 200 / 200 / 200 | Token rotation and reuse detection. |
| 123 | `POST api/v1/auth/logout` | `[Authorize]` | 401 / 200 / 200 / 200 | Authenticated User | 401 / 200 / 200 / 200 | Revokes refresh tokens and clears cookies. |
| 124 | `GET api/v1/auth/me` | `[Authorize]` | 401 / 200 / 200 / 200 | Authenticated User | 401 / 200 / 200 / 200 | Returns current user profile, roles, and TOTP status. |
| 125 | `POST api/v1/auth/change-password` | `[Authorize]` | 401 / 200 / 200 / 200 | Authenticated User | 401 / 200 / 200 / 200 | BCrypt cost 12+, revokes existing refresh tokens. |
| 126 | `POST api/v1/auth/2fa/setup` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Valid Challenge / Authenticated | 200 / 200 / 200 / 200 | Requires valid challengeId from login or authenticated session. Returns base32Key and otpauth URI. |
| 127 | `POST api/v1/auth/2fa/confirm` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Valid Challenge / Authenticated | 200 / 200 / 200 / 200 | Verifies 6-digit TOTP code, enables TOTP, returns 10 single-use recovery codes and auth tokens. |
| 128 | `POST api/v1/auth/2fa/verify` | `[AllowAnonymous]` | 200 / 200 / 200 / 200 | Valid Challenge | 200 / 200 / 200 / 200 | Verifies TOTP code or recovery code against challenge. Issues trusted device cookie if requested. |
| 129 | `POST api/v1/auth/2fa/recovery-codes` | `[Authorize]` | 401 / 200 / 200 / 200 | Authenticated User | 401 / 200 / 200 / 200 | Re-generates 10 backup codes; revokes old ones. |
| 130 | `POST api/v1/auth/2fa/disable` | `[Authorize]` | 401 / 200 / 200 / 200 | Authenticated User | 401 / 200 / 200 / 200 | Requires current TOTP code or password to disable. |
| 131 | `GET api/v1/auth/2fa/status` | `[Authorize]` | 401 / 200 / 200 / 200 | Authenticated User | 401 / 200 / 200 / 200 | Returns enabled status, enrollment timestamp, remaining recovery codes count. |
