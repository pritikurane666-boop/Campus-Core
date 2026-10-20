# CampusCore (institution-erp) — Architecture & Security Decisions Log

**Branch:** `prod-hardening`  
**Status:** Canonical & Locked (Do Not Re-Ask)

This document formalizes all architectural, security, and infrastructure decisions established for the production hardening of CampusCore (`institution-erp`).

---

## 1. Role-Based Access Control (RBAC) & Policies
- **Canonical Roles:** Exactly three roles exist in the system:
  1. `Principal` (Institution Administrator & Executive)
  2. `Teacher` (Faculty & Class Teacher)
  3. `Student` (Enrolled Student)
- **Dead Role Removal:** All occurrences of `"SuperAdmin"`, `"Admin"`, `"Accountant"`, and `"Parent"` as string literals, enum members, seeded database records, or UI routes are deprecated and MUST be safely removed.
- **Authorization Model:**
  - Authorization by ASP.NET Core **Policies** (`RequireRole(RoleNames.Principal)`, etc.) rather than ad-hoc inline role strings.
  - **Deny by default:** Endpoints without an explicit authorization policy are rejected.
  - Parent policy in `Program.cs` is eliminated; student dashboards and portals serve enrolled students.
  - Fail-open scoping checks (e.g. `if (User.IsInRole("Teacher"))` without a strict `else` returning `Forbid()`) must be replaced with centralized resource authorization handlers or query filters that verify ownership or class allocation and deny immediately if the profile record is missing.

---

## 2. Credential Management & Password Security
- **No Plaintext Password Storage:**
  - Plaintext passwords must **NEVER** be stored in the database.
  - The `users.default_password` column and the `User.DefaultPassword` entity property will be completely removed.
  - The startup `ALTER TABLE users ADD COLUMN IF NOT EXISTS default_password` statement in `Program.cs` will be deleted.
- **Principal Credential Hand-Off:**
  - The Principal must be able to hand initial or reset credentials to teachers and students.
  - Creating a teacher/student/user, approving an admission, or resetting a password generates a **CSPRNG temporary password** (14+ characters, avoiding ambiguous characters like `0`, `O`, `l`, `1`, `I`).
  - This temporary password is returned **ONCE** in that immediate API response only (restricted to `Principal` role only).
  - The frontend displays it in a secure modal with "Copy" and "Print Credential Slip" actions.
  - The temporary password is **never logged**, never included in the audit log, never stored in the notification outbox, and never returned in any `GET` endpoint.
- **Password Storage & Policy:**
  - Passwords stored strictly as BCrypt hashes (Work Factor / Cost 12+).
  - All formula-based passwords (e.g. `Welcome@{regNo}` or `Teach@{phone}`) and fallback comparisons in `AuthController.Login` will be deleted.
  - Unknown user and invalid password return the identical generic error message (`Invalid email or password`).
  - First-time login flag: `MustChangePassword = true` is set on all generated accounts and **enforced server-side** (all endpoints except `/auth/change-password` and `/auth/logout` are blocked until changed).
- **Reset & Bulk Enrollment:**
  - Bulk enrollment and admission approval return a one-time downloadable credential slip (PDF/CSV generated in memory, never written to disk).
  - Password reset tokens use a long random single-use token (hashed in DB), short expiry (15–30 mins), and rate-limited attempts.
  - All existing refresh tokens for a user are revoked upon password change or reset.

---

## 3. API Routing & Hosting Architecture
- **Frontend Hosting:** Vercel (Single Page Application, Vite + React 19).
- **Backend Hosting:** Render (Docker Web Service, .NET 8).
- **Routing & Reverse Proxy:**
  - Frontend calls all API endpoints via the relative path `/api/v1`.
  - `vercel.json` provides a reverse-proxy rewrite:
    `/api/:path*` -> `https://RENDER_SERVICE_NAME.onrender.com/api/:path*`
  - Fallback route `/*` routes to `/index.html` for client-side routing.
  - Eliminates browser CORS preflight overhead in production and allows secure cookie sharing across same-origin paths.

---

## 4. Email & Notifications
- **Production Provider:** **Brevo** (formerly Sendinblue) Transactional API over HTTPS (`POST https://api.brevo.com/v3/smtp/email`) using the `api-key` header (not Bearer).
- **Channel Abstraction:** Implemented behind `INotificationChannel` via `BrevoEmailChannel`.
- **Local Development:** MailHog / local SMTP container used strictly in Development environment.
- **Daily Limit & Resilience:**
  - Free plan daily cap: 300 emails/day (`Email__DailyLimit=300`).
  - When the daily cap is reached, outbox worker leaves remaining messages in `Pending` state to resume after the daily reset, rather than marking them `Failed`.
  - High-priority emails (password resets, credential slips) are prioritized over non-critical notices and alerts.
  - SMTP/API exceptions must **not** be caught silently to return `true`; failed attempts remain pending for retry up to max retry count (3), after which they enter `DeadLetter` / `Failed`.
  - Notification outbox bodies are scrubbed upon successful delivery; email bodies and API keys are never logged.

---

## 5. File Storage Architecture
- **Provider:** **Supabase Storage** (Private S3-compatible bucket).
- **Access Pattern:** Server-side only via Supabase Service Role Key.
- **Client Security:** No anonymous direct uploads or public bucket access from frontend; frontend communicates only with the backend.
- **Backend Validation:**
  - Uploaded files validated server-side for magic bytes (e.g., `%PDF-` for PDFs, image headers for JPEG/PNG).
  - File size capped (e.g., 5 MB per document) and total document count strictly limited.
  - Stored files assigned cryptographically random server-side GUIDs/names.
  - Files streamed to authenticated clients through authorized API endpoints (`AdmissionsController.DownloadDocument`).
- **Development Fallback:** Local filesystem storage used only when `ASPNETCORE_ENVIRONMENT=Development`.

---

## 6. Payment Gateway Architecture
- **Provider:** Razorpay.
- **Production Default:** **Disabled and Fail-Closed** (`Payment:Razorpay:Enabled=false`).
- **Fail-Closed Behavior:**
  - If disabled, `create-order` returns HTTP 501 / 404.
  - `VerifySignature` returns `false` when disabled or when configuration is missing.
  - Mock verification returning `true` unconditionally is deleted.
  - Hardcoded fallback test secret `DummySecretForDev123` is completely removed.
  - Signature verification uses constant-time byte comparisons (`CryptographicOperations.FixedTimeEquals`).
  - Fee payment amounts are computed and validated exclusively on the server from `StudentFee` records.

---

## 7. Database & Migrations
- **Database Engine:** PostgreSQL 18 on Supabase (Port 5432 session pooler or direct connection with SSL required).
- **Migration Strategy:**
  - Production utilizes real EF Core Migrations (`dotnet ef migrations add InitialCreate`).
  - `EnsureCreatedAsync()` and runtime `ALTER TABLE` statements in `Program.cs` are removed.
  - Migrations are applied via an explicit CLI command (`dotnet ef database update`) from administrator terminal or deployment pipeline, **never automatically on startup in Production**.
- **Row Level Security (RLS):**
  - Enabled on all public tables in Supabase with deny-all permissive policies for anonymous/external API access (the backend connects directly via PostgreSQL connection string).

---

## 8. Frontend Token Storage & Session Management
- **Refresh Token Storage:** Transferred from browser `localStorage` to an **HttpOnly, Secure, SameSite=Strict** cookie set by the backend API.
- **Access Token:** Maintained in memory during the session.
- **User Identity:** Loaded via `GET /api/v1/auth/me` upon application initialization instead of deserializing cached user JSON from `localStorage`.
- **Token Rotation & Reuse Detection:**
  - When a refresh token is presented, a new refresh token and access token are issued.
  - If an already-revoked or expired refresh token is presented, all active refresh tokens for that user are immediately revoked (compromise defense).

---

## 9. UX Polish & Micro-Animations
- **Performance Guardrails:**
  - CSS-first animations via Tailwind transitions and `@keyframes`.
  - Animate only GPU-accelerated properties (`transform`, `opacity`), never layout geometry (`width`, `height`, `margin`, `padding`).
  - Subtle micro-durations: 120 ms to 250 ms with `ease-out`.
  - Full compliance with `@media (prefers-reduced-motion: reduce)`.
  - Zero layout shift (CLS = 0) and skeleton loaders mirroring actual content dimensions.
