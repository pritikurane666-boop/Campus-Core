# CampusCore (institution-erp) — Questions & Unfilled Placeholders

**Branch:** `prod-hardening`  
**Status:** Open for Project Owner Review

---

## 1. Unfilled Deployment Placeholders

The following placeholders are required for deployment manifests (`vercel.json`, `render.yaml`, environment configuration) and must be provided by the project owner before Phase 8:

| Placeholder | Context | Current Value | Required Action |
|---|---|---|---|
| `RENDER_SERVICE_NAME` | `vercel.json` API rewrite URL (`https://<RENDER_SERVICE_NAME>.onrender.com/api/:path*`) | `<UNFILLED>` | Specify the exact name of the Render web service to be created. |
| `EMAIL_FROM_ADDRESS` | Brevo SMTP/Transactional API sender verification | `<UNFILLED>` | Provide the verified sender email address registered and verified in Brevo (e.g. `notifications@institution.edu`). |
| `EMAIL_FROM_NAME` | Brevo Transactional API sender display name | `CampusCore ERP` | Confirm if this is the desired display name for transactional emails. |

---

## 2. Infrastructure & External Services Credentials

To configure `.env.production` / Render Environment Variables, please prepare the following external service credentials:

1. **Supabase PostgreSQL Session Pooler Connection String:**
   - Format: `Host=aws-0-[region].pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.[project-ref];Password=[password];SslMode=Require;Trust Server Certificate=true;`
   - *Note:* Session pooler (port 5432) or transaction pooler (port 6543 with prepared statements disabled).
2. **Supabase Storage Service Credentials:**
   - `Supabase__Url`: `https://[project-ref].supabase.co`
   - `Supabase__ServiceRoleKey`: Supabase `service_role` secret key (for server-side private bucket uploads/downloads).
   - `Supabase__StorageBucket`: Name of private bucket (e.g. `campuscore-documents`).
3. **Brevo API Key:**
   - `Email__ApiKey`: Brevo API key (`xkeysib-...`) for sending transactional emails via REST API.
4. **Initial Administrator Bootstrapping:**
   - `Admin__Email`: Desired initial Principal email (default: `principal@institution.edu`).
   - `Admin__Password`: Initial strong temporary bootstrap password (must be 14+ characters, mixed case, numbers, symbols).

---

## 3. Architecture & Functional Clarifications

1. **Parent Role & Portal Scope:**
   - *Observation:* The database and frontend previously contained partial references to a `"Parent"` role, but `UserRoleType` domain enum only defines `Principal`, `Teacher`, and `Student`. The student portal (`ParentDashboardPage.tsx` / `/portal`) was also used by students to check their own marks and timetable.
   - *Decision Made:* Dead `"Parent"` role literals are removed.
   - *Question:* Should parent access be completely deferred to a future phase, or will students and their guardians share student portal credentials for viewing reports and fee receipts? (Assumed: Students access their own portal).
2. **Notification Outbox Cleanup Policy:**
   - Once an email or notification is marked `Sent`, its body will be scrubbed to protect privacy.
   - *Question:* What retention duration is preferred for the metadata logs of sent notifications (e.g. delete records older than 30 days or retain metadata indefinitely for institutional audit trails)?
3. **Razorpay Activation Timeline:**
   - Razorpay will be shipped disabled (`Payment__Razorpay__Enabled=false`) and fail-closed.
   - *Question:* When online payments are enabled in the future, will the institution use standard Razorpay Orders API or Razorpay Route / Payment Links?
