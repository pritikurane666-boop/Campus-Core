# CampusCore — Break-Glass Procedure for Principal 2FA Lockout

**Document:** `audit/BREAK_GLASS.md`  
**Purpose:** Secure disaster recovery runbook for when an institution administrator or Principal is locked out of Two-Factor Authentication (e.g., lost phone, broken authenticator app, consumed recovery codes).

> [!CAUTION]
> This runbook is strictly for emergency use by authorized infrastructure operators with direct server or database access.
> There is **no public or unauthenticated HTTP endpoint** for 2FA bypass.

---

## Method 1: Server CLI Break-Glass Tool (Recommended)

When connected to the server host or container shell (e.g. Render Shell, Docker exec, or server SSH):

### Command Syntax:
```bash
cd /app
dotnet run --project InstitutionErp.Api -- reset-2fa --email principal@campuscore.edu
```

### What this tool does automatically:
1. Prompts for explicit interactive confirmation (`Type 'YES' to confirm`).
2. Deletes the user's TOTP secret (`UserTotps` table).
3. Deletes any remaining recovery codes (`UserTotpRecoveryCodes` table).
4. Revokes all trusted devices for that user (`TotpTrustedDevices` table).
5. Revokes all active refresh tokens for that user to terminate active sessions immediately.
6. Writes an immutable audit entry to `AuditLogs` with action `TotpBreakGlassCLIReset` and entity ID.
7. Forces the user to re-enroll in 2FA with a new secret key at their immediate next login.

---

## Method 2: Direct Database Runbook (PostgreSQL / Supabase SQL Editor)

If application CLI execution is unavailable, an operator with PostgreSQL access can run the following transaction in the Supabase SQL Editor or `psql`:

```sql
BEGIN;

-- 1. Identify target user ID
DO $$
DECLARE
    v_user_id UUID;
    v_target_email TEXT := 'principal@campuscore.edu'; -- << EDIT EMAIL HERE
BEGIN
    SELECT id INTO v_user_id FROM users WHERE lower(email) = lower(v_target_email);
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', v_target_email;
    END IF;

    -- 2. Remove TOTP configuration
    DELETE FROM user_totps WHERE user_id = v_user_id;

    -- 3. Invalidate all recovery codes
    DELETE FROM user_totp_recovery_codes WHERE user_id = v_user_id;

    -- 4. Invalidate all trusted devices
    DELETE FROM totp_trusted_devices WHERE user_id = v_user_id;

    -- 5. Revoke all refresh tokens
    UPDATE refresh_tokens 
    SET is_revoked = TRUE 
    WHERE user_id = v_user_id AND is_revoked = FALSE;

    -- 6. Insert audit trail record
    INSERT INTO audit_logs (
        id, action, entity_name, entity_id, user_id, 
        new_values_json, created_at, created_by, is_deleted
    ) VALUES (
        gen_random_uuid(),
        'TotpBreakGlassSqlReset',
        'User',
        v_user_id::text,
        NULL,
        json_build_object('resetBy', 'manual-dba-sql', 'email', v_target_email)::text,
        NOW() AT TIME ZONE 'UTC',
        'DBA_BREAK_GLASS',
        FALSE
    );

    RAISE NOTICE 'Successfully reset 2FA for % (UserID: %)', v_target_email, v_user_id;
END $$;

COMMIT;
```

---

## Next Steps for the User

1. The Principal navigates to the login screen and enters their email and password.
2. Because the `Principal` role requires 2FA (`Totp:RequiredRoles`), the server automatically responds with `requiresTotpSetup: true`.
3. The Principal is redirected to `/auth/2fa/setup` to scan a new QR code in Google or Microsoft Authenticator.
4. Once verified, the Principal receives 10 new recovery backup codes.
