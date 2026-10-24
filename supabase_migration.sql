-- ====================================================================
-- Dhanbad Municipal Corporation (DMC) — Attendance System
-- Database Migration (Phase 1): Hardened RLS, Functions & Non-Destructive Integrity
-- ====================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Extend Staff Table with Administrative & Contact Fields
ALTER TABLE public.staff 
  ADD COLUMN IF NOT EXISTS ward TEXT DEFAULT 'Ward 12 (Bank More / बैंक मोड़)',
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Sanitation',
  ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'Sanitation Worker',
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Extend Attendance Table with Ward, Verification & Status Flags
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS ward TEXT DEFAULT 'Ward 12 (Bank More / बैंक मोड़)',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Present',
  ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 4. Preflight Diagnostic Views for Existing Duplicates (Task 3)
-- These views inspect historical records without modifying data.
CREATE OR REPLACE VIEW public.duplicate_attendance_diagnostics AS
SELECT 
  staff_user_id, 
  emp_id, 
  staff_name, 
  date, 
  count(*) AS duplicate_count, 
  array_agg(id) AS duplicate_attendance_ids
FROM public.attendance
GROUP BY staff_user_id, emp_id, staff_name, date
HAVING count(*) > 1;

CREATE OR REPLACE VIEW public.duplicate_staff_diagnostics AS
SELECT 
  emp_id, 
  count(*) AS duplicate_count, 
  array_agg(id) AS duplicate_staff_ids, 
  array_agg(name) AS duplicate_names
FROM public.staff
WHERE emp_id IS NOT NULL
GROUP BY emp_id
HAVING count(*) > 1;

-- 4a. Safe Non-Destructive Database Uniqueness Constraint on attendance(staff_user_id, date)
-- Does NOT delete historical duplicate records. Raises prominent warning if duplicates exist.
-- RECONCILIATION REQUIRED BEFORE OFFICIAL ATTENDANCE:
-- If duplicates are found, query public.duplicate_attendance_diagnostics.
-- Reconcile duplicates (e.g. keep earliest in_time punch, delete spurious duplicates),
-- then re-run this migration block to apply the uq_attendance_worker_date constraint.
DO $$
DECLARE
  v_dup_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_worker_date'
  ) THEN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
      SELECT staff_user_id, date, count(*)
      FROM public.attendance
      GROUP BY staff_user_id, date
      HAVING count(*) > 1
    ) d;

    IF v_dup_count > 0 THEN
      RAISE WARNING 'CRITICAL PREFLIGHT WARNING: % duplicate attendance pairs found in public.attendance. Uniqueness constraint uq_attendance_worker_date was NOT applied. Query public.duplicate_attendance_diagnostics to review and reconcile before official attendance enforcement.', v_dup_count;
    ELSE
      ALTER TABLE public.attendance 
        ADD CONSTRAINT uq_attendance_worker_date UNIQUE (staff_user_id, date);
      RAISE NOTICE 'SUCCESS: Unique constraint uq_attendance_worker_date successfully applied.';
    END IF;
  END IF;
END $$;

-- 4b. Safe Non-Destructive Database Uniqueness Constraint on staff(emp_id)
-- RECONCILIATION REQUIRED BEFORE OFFICIAL REGISTRATION:
-- If duplicate employee IDs exist, query public.duplicate_staff_diagnostics.
-- Reassign or delete duplicate staff IDs, then re-run to apply uq_staff_emp_id.
DO $$
DECLARE
  v_dup_staff_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_emp_id'
  ) THEN
    SELECT COUNT(*) INTO v_dup_staff_count
    FROM (
      SELECT emp_id, count(*)
      FROM public.staff
      WHERE emp_id IS NOT NULL
      GROUP BY emp_id
      HAVING count(*) > 1
    ) d;

    IF v_dup_staff_count > 0 THEN
      RAISE WARNING 'CRITICAL PREFLIGHT WARNING: % duplicate staff emp_id records found in public.staff. Uniqueness constraint uq_staff_emp_id was NOT applied. Query public.duplicate_staff_diagnostics to review and reconcile.', v_dup_staff_count;
    ELSE
      ALTER TABLE public.staff 
        ADD CONSTRAINT uq_staff_emp_id UNIQUE (emp_id);
      RAISE NOTICE 'SUCCESS: Unique constraint uq_staff_emp_id successfully applied.';
    END IF;
  END IF;
END $$;

-- 5. Attendance Corrections Audit Ledger (Rule 8 & 9)
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
  staff_user_id UUID,
  emp_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  correction_type TEXT NOT NULL DEFAULT 'CHECKOUT_REGULARIZATION',
  old_in_time TIMESTAMPTZ,
  old_out_time TIMESTAMPTZ,
  new_in_time TIMESTAMPTZ,
  new_out_time TIMESTAMPTZ,
  reason TEXT NOT NULL,
  corrected_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Period Locks / Payroll Freeze Table (Rule 15)
CREATE TABLE IF NOT EXISTS public.period_locks (
  month_key TEXT PRIMARY KEY,
  locked_by TEXT DEFAULT 'Admin',
  locked_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 7. CLEAN UP ALL OBSOLETE & OVERLOADED FUNCTION SIGNATURES
-- ============================================================================
-- Note: is_admin() is NOT dropped here to prevent rerun failure caused by dependent RLS policies.
-- It is safely updated below via CREATE OR REPLACE FUNCTION.
DROP FUNCTION IF EXISTS public.do_check_in(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.do_check_in(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.do_check_in(TEXT);
DROP FUNCTION IF EXISTS public.do_check_in();
DROP FUNCTION IF EXISTS public.admin_create_staff(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.do_check_out(UUID);
DROP FUNCTION IF EXISTS public.regularize_attendance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);

-- ============================================================================
-- 8. HELPER: is_admin() (SECURITY DEFINER with fixed search_path, prevents RLS recursion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' AND active = true FROM public.staff WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 9. HARDENED do_check_in RPC
-- ============================================================================
-- Derives identity & official ward strictly from DB profile (never trusts browser parameters).
-- Blocks inactive workers, enforces 6:00-8:00 AM IST window, blocks Sundays and locked periods.
CREATE OR REPLACE FUNCTION public.do_check_in(
  p_ward TEXT DEFAULT NULL,
  p_emp_id TEXT DEFAULT NULL,
  p_staff_name TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff      public.staff;
  v_today      TEXT;
  v_month      TEXT;
  v_mins       INT;
  v_dow        INT;
  v_rec        public.attendance;
BEGIN
  -- 1. Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to perform check-in.';
  END IF;

  -- 2. Derive worker identity strictly from active staff record in DB
  SELECT * INTO v_staff
  FROM public.staff
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active staff record found for this account. Contact your administrator.';
  END IF;

  IF v_staff.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Your employee account is marked inactive. Attendance submission is disabled.';
  END IF;

  IF v_staff.role = 'admin' THEN
    RAISE EXCEPTION 'Administrator accounts cannot record field attendance.';
  END IF;

  -- 3. Calculate IST time components server-side
  v_today := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');
  v_month := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');
  v_dow   := extract(DOW FROM (now() AT TIME ZONE 'Asia/Kolkata'));
  v_mins  := extract(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata')) * 60
           + extract(MINUTE FROM (now() AT TIME ZONE 'Asia/Kolkata'));

  -- 4. Idempotency Retry Check (Task 6):
  -- After identity and active status are verified, return already-recorded result for a legitimate retry.
  -- Do not reject an unchanged record solely because the attendance window has since closed or period was locked.
  SELECT * INTO v_rec
  FROM public.attendance
  WHERE staff_user_id = auth.uid() AND date = v_today;

  IF FOUND THEN
    RETURN row_to_json(v_rec);
  END IF;

  -- 5. Guard: Sunday weekly off (for genuinely new attendance submissions)
  IF v_dow = 0 THEN
    RAISE EXCEPTION 'Sunday is an official weekly off. Check-in is not permitted today.';
  END IF;

  -- 6. Guard: 06:00 AM to 08:00 AM IST window (360 - 480 mins inclusive) (for new submissions)
  IF v_mins < 360 OR v_mins > 480 THEN
    RAISE EXCEPTION 'Check-in window is closed. Official shift punch window is 06:00 AM – 08:00 AM IST.';
  END IF;

  -- 7. Guard: Block if month is locked (for new submissions)
  IF EXISTS (SELECT 1 FROM public.period_locks WHERE month_key = v_month) THEN
    RAISE EXCEPTION 'Attendance period % has been locked for payroll.', v_month;
  END IF;

  -- 8. Insert record using TRUSTED database identity and official assigned ward
  -- Handles concurrent insert races via unique_violation exception handler
  BEGIN
    INSERT INTO public.attendance (
      staff_user_id,
      emp_id,
      staff_name,
      date,
      month_key,
      in_time,
      ward,
      status
    ) VALUES (
      v_staff.user_id,
      v_staff.emp_id,
      v_staff.name,
      v_today,
      v_month,
      now(),
      COALESCE(v_staff.ward, 'Ward 12 (Bank More / बैंक मोड़)'),
      'Present'
    ) RETURNING * INTO v_rec;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_rec
      FROM public.attendance
      WHERE staff_user_id = auth.uid() AND date = v_today;
  END;

  RETURN row_to_json(v_rec);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.do_check_in(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.do_check_in(TEXT, TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.do_check_in(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 10. HARDENED do_check_out RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.do_check_out(p_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec           public.attendance;
  v_today         TEXT;
  v_elapsed_hours NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to perform check-out.';
  END IF;

  v_today := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');

  -- TASK 4: Row-level lock to prevent concurrent checkout race conditions.
  -- Strictly restricted to the authenticated session owner who checked in.
  -- Administrative checkout must use the audited regularize_attendance RPC.
  SELECT * INTO v_rec
  FROM public.attendance
  WHERE id = p_id
    AND staff_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance session not found or unauthorized. Only the worker who checked in can perform regular check-out. Administrative adjustments must use regularize_attendance.';
  END IF;

  -- Inactive check: inactive staff cannot punch checkout
  IF NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE user_id = auth.uid() AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Your employee account is marked inactive. Attendance submission is disabled.';
  END IF;

  -- TASK 6: Idempotency Retry Check
  -- If this session is ALREADY checked out, return the existing completed record immediately.
  -- Legitimate retries must not fail just because midnight passed or period was locked subsequently.
  IF v_rec.out_time IS NOT NULL THEN
    RETURN row_to_json(v_rec);
  END IF;

  -- For an ACTUAL check-out attempt:
  -- Validate check-in exists
  IF v_rec.in_time IS NULL THEN
    RAISE EXCEPTION 'Cannot check out: no valid check-in punch found for this session.';
  END IF;

  -- Period lock check
  IF EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE month_key = COALESCE(v_rec.month_key, substring(v_rec.date from 1 for 7))
  ) THEN
    RAISE EXCEPTION 'Attendance period % has been locked for payroll.', COALESCE(v_rec.month_key, substring(v_rec.date from 1 for 7));
  END IF;

  IF v_rec.date <> v_today THEN
    RAISE EXCEPTION 'Cannot check out for a previous day shift (%). Supervisor regularization required.', v_rec.date;
  END IF;

  v_elapsed_hours := EXTRACT(EPOCH FROM (now() - v_rec.in_time)) / 3600.0;
  IF v_elapsed_hours > 14 THEN
    RAISE EXCEPTION 'Shift duration exceeds maximum shift limit. Please request administrative regularization.';
  END IF;

  IF now() < v_rec.in_time THEN
    RAISE EXCEPTION 'Invalid timestamp: check-out time cannot precede check-in time.';
  END IF;

  UPDATE public.attendance
  SET out_time = now()
  WHERE id = p_id
  RETURNING * INTO v_rec;

  RETURN row_to_json(v_rec);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.do_check_out(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.do_check_out(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.do_check_out(UUID) TO authenticated;

-- ============================================================================
-- 11. ATOMIC regularize_attendance RPC (Admin Only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.regularize_attendance(
  p_attendance_id UUID,
  p_new_in_time TIMESTAMPTZ,
  p_new_out_time TIMESTAMPTZ,
  p_reason TEXT,
  p_correction_type TEXT DEFAULT 'TIME_CORRECTION'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec           public.attendance;
  v_audit         public.attendance_corrections;
  v_in_date       TEXT;
  v_out_date      TEXT;
  v_in_month      TEXT;
  v_elapsed_hours NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can regularize attendance records.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Correction reason is mandatory for municipal audit compliance.';
  END IF;

  IF p_new_in_time IS NULL THEN
    RAISE EXCEPTION 'Check-in time is required for regularization.';
  END IF;

  IF p_new_out_time IS NULL THEN
    RAISE EXCEPTION 'Check-out time is required for regularization.';
  END IF;

  IF p_new_out_time <= p_new_in_time THEN
    RAISE EXCEPTION 'Check-out time must be strictly after check-in time.';
  END IF;

  -- Comply with existing shift-duration rules (max 14 hours)
  v_elapsed_hours := EXTRACT(EPOCH FROM (p_new_out_time - p_new_in_time)) / 3600.0;
  IF v_elapsed_hours > 14.0 THEN
    RAISE EXCEPTION 'Shift duration (%) exceeds maximum shift limit of 14 hours.', round(v_elapsed_hours, 2);
  END IF;

  SELECT * INTO v_rec
  FROM public.attendance
  WHERE id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found.';
  END IF;

  -- Validate that timestamps correspond to the stored attendance date under Asia/Kolkata rules (Task 5)
  v_in_date  := to_char((p_new_in_time AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');
  v_out_date := to_char((p_new_out_time AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');
  v_in_month := to_char((p_new_in_time AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');

  IF v_in_date <> v_rec.date THEN
    RAISE EXCEPTION 'Corrected check-in timestamp date (%) does not match the attendance record date (%).', v_in_date, v_rec.date;
  END IF;

  -- Check-out date must be same date or next calendar day if spanning midnight within 14 hours
  IF v_out_date <> v_rec.date AND v_out_date <> to_char(((p_new_in_time + interval '1 day') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') THEN
    RAISE EXCEPTION 'Corrected check-out timestamp date (%) is inconsistent with attendance record date (%).', v_out_date, v_rec.date;
  END IF;

  -- Period lock verification: if period is locked, must be an authorized post-lock override (Rule 15)
  IF EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE month_key = COALESCE(v_rec.month_key, substring(v_rec.date from 1 for 7))
  ) THEN
    IF p_correction_type <> 'LOCKED_PERIOD_OVERRIDE' AND p_reason NOT LIKE '%[POST-LOCK OVERRIDE]%' THEN
      RAISE EXCEPTION 'Attendance period % is locked for payroll. Post-lock administrative override required.', COALESCE(v_rec.month_key, substring(v_rec.date from 1 for 7));
    END IF;
  END IF;

  -- Atomic audit ledger entry
  INSERT INTO public.attendance_corrections (
    attendance_id,
    staff_user_id,
    emp_id,
    staff_name,
    correction_type,
    old_in_time,
    old_out_time,
    new_in_time,
    new_out_time,
    reason,
    corrected_by
  ) VALUES (
    v_rec.id,
    v_rec.staff_user_id,
    v_rec.emp_id,
    v_rec.staff_name,
    p_correction_type,
    v_rec.in_time,
    v_rec.out_time,
    p_new_in_time,
    p_new_out_time,
    trim(p_reason),
    COALESCE((SELECT name FROM public.staff WHERE user_id = auth.uid()), 'Admin')
  ) RETURNING * INTO v_audit;

  -- Atomic attendance record update ensuring date and month_key stay consistent with corrected timestamps
  UPDATE public.attendance
  SET in_time = p_new_in_time,
      out_time = p_new_out_time,
      date = v_in_date,
      month_key = v_in_month,
      is_corrected = true,
      remarks = trim(p_reason)
  WHERE id = p_attendance_id
  RETURNING * INTO v_rec;

  RETURN row_to_json(v_rec);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regularize_attendance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regularize_attendance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.regularize_attendance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 12. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

-- Drop all legacy and obsolete policies (Task 1 & Task 2)
DROP POLICY IF EXISTS auth_staff_all            ON public.staff;
DROP POLICY IF EXISTS auth_att_all              ON public.attendance;
DROP POLICY IF EXISTS staff_select_policy       ON public.staff;
DROP POLICY IF EXISTS staff_modify_policy       ON public.staff;
DROP POLICY IF EXISTS staff_self_ward_update    ON public.staff;
DROP POLICY IF EXISTS staff_admin_all           ON public.staff;
DROP POLICY IF EXISTS staff_admin_modify        ON public.staff;
DROP POLICY IF EXISTS attendance_select_policy  ON public.attendance;
DROP POLICY IF EXISTS attendance_modify_policy  ON public.attendance;
DROP POLICY IF EXISTS attendance_admin_modify   ON public.attendance;
DROP POLICY IF EXISTS corrections_policy        ON public.attendance_corrections;
DROP POLICY IF EXISTS corrections_admin_policy  ON public.attendance_corrections;
DROP POLICY IF EXISTS period_locks_policy       ON public.period_locks;
DROP POLICY IF EXISTS period_locks_admin_policy ON public.period_locks;

-- A. Staff Directory RLS:
-- Workers can view ONLY their own profile record. Admin can view all.
CREATE POLICY staff_select_policy ON public.staff
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_admin()
  );

-- Only Admin can INSERT, UPDATE, or DELETE staff records.
-- Ordinary workers CANNOT modify role, emp_id, active, ward, phone, etc.
CREATE POLICY staff_admin_modify ON public.staff
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- B. Attendance RLS:
-- Workers can view ONLY their own attendance. Admin can view all.
CREATE POLICY attendance_select_policy ON public.attendance
  FOR SELECT TO authenticated
  USING (
    staff_user_id = auth.uid() OR public.is_admin()
  );

-- Direct attendance INSERT, UPDATE, DELETE allowed ONLY for Admins.
-- Workers must use do_check_in / do_check_out (SECURITY DEFINER).
CREATE POLICY attendance_admin_modify ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- C. Attendance Corrections RLS:
-- Admin-only access to audit trail.
CREATE POLICY corrections_admin_policy ON public.attendance_corrections
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- D. Period Locks RLS:
-- Admin-only access to payroll freeze table.
CREATE POLICY period_locks_admin_policy ON public.period_locks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 13. ATOMIC STAFF REGISTRATION, PIN RESET & PROFILE PROCEDURES
-- ============================================================================

-- A. admin_register_staff: 100% Atomic User + Profile Creation
CREATE OR REPLACE FUNCTION public.admin_register_staff(
  p_emp_id TEXT,
  p_name TEXT,
  p_pin TEXT,
  p_ward TEXT DEFAULT 'Ward 12 (Bank More / बैंक मोड़)',
  p_department TEXT DEFAULT 'Sanitation',
  p_designation TEXT DEFAULT 'Sanitation Worker',
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'staff'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_clean_id   TEXT;
  v_clean_name TEXT;
  v_email      TEXT;
  v_user_id    UUID;
  v_existing_staff public.staff;
  v_result     public.staff;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only system administrators can register staff accounts.';
  END IF;

  v_clean_id := upper(trim(p_emp_id));
  v_clean_name := trim(p_name);

  IF v_clean_id IS NULL OR v_clean_id = '' THEN
    RAISE EXCEPTION 'Employee ID is required.';
  END IF;

  IF v_clean_name IS NULL OR v_clean_name = '' THEN
    RAISE EXCEPTION 'Employee Name is required.';
  END IF;

  IF p_pin IS NULL OR length(trim(p_pin)) < 6 THEN
    RAISE EXCEPTION 'PIN must be at least 6 characters.';
  END IF;

  SELECT * INTO v_existing_staff
  FROM public.staff
  WHERE upper(emp_id) = v_clean_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Employee ID % is already registered to %.', v_clean_id, v_existing_staff.name;
  END IF;

  v_email := lower(v_clean_id) || '@dmc.org';

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.staff WHERE user_id = v_user_id) THEN
      RAISE EXCEPTION 'Authentication identity for % is already linked to another staff record.', v_clean_id;
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(trim(p_pin), extensions.gen_salt('bf', 6)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now(),
        raw_user_meta_data = jsonb_build_object('name', v_clean_name, 'emp_id', v_clean_id)
    WHERE id = v_user_id;

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      NULL,
      now(),
      now(),
      v_email
    ) ON CONFLICT (provider, provider_id) DO UPDATE
      SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          updated_at = now();
  ELSE
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(trim(p_pin), extensions.gen_salt('bf', 6)),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'name', v_clean_name, 'emp_id', v_clean_id)::jsonb,
      false,
      false,
      false
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      NULL,
      now(),
      now(),
      v_email
    );
  END IF;

  INSERT INTO public.staff (
    user_id, name, emp_id, role, ward, department, designation, phone, active
  ) VALUES (
    v_user_id,
    v_clean_name,
    v_clean_id,
    COALESCE(p_role, 'staff'),
    COALESCE(p_ward, 'Ward 12 (Bank More / बैंक मोड़)'),
    COALESCE(p_department, 'Sanitation'),
    COALESCE(p_designation, 'Sanitation Worker'),
    nullif(trim(p_phone), ''),
    true
  ) RETURNING * INTO v_result;

  RETURN row_to_json(v_result);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_register_staff FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_register_staff FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_register_staff TO authenticated;

-- B. admin_reset_staff_pin: Instant Admin PIN Reset
CREATE OR REPLACE FUNCTION public.admin_reset_staff_pin(
  p_staff_id UUID,
  p_new_pin TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_staff public.staff;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only system administrators can reset employee PINs.';
  END IF;

  IF p_new_pin IS NULL OR length(trim(p_new_pin)) < 6 THEN
    RAISE EXCEPTION 'New PIN must be at least 6 characters.';
  END IF;

  SELECT * INTO v_staff
  FROM public.staff
  WHERE id = p_staff_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff record not found.';
  END IF;

  IF v_staff.user_id IS NULL THEN
    RAISE EXCEPTION 'Staff member has no associated authentication account.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(trim(p_new_pin), extensions.gen_salt('bf', 6)),
      updated_at = now()
  WHERE id = v_staff.user_id;

  RETURN json_build_object(
    'success', true,
    'staff_id', v_staff.id,
    'emp_id', v_staff.emp_id,
    'name', v_staff.name,
    'message', 'PIN updated successfully'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_staff_pin FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_staff_pin FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_reset_staff_pin TO authenticated;

-- C. admin_update_staff: Safe Profile Mutation (Ward transfer, Phone, Dept)
CREATE OR REPLACE FUNCTION public.admin_update_staff(
  p_staff_id UUID,
  p_name TEXT,
  p_ward TEXT,
  p_department TEXT,
  p_designation TEXT,
  p_phone TEXT,
  p_role TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.staff;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can edit staff profiles.';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name cannot be empty.';
  END IF;

  UPDATE public.staff
  SET name = trim(p_name),
      ward = COALESCE(p_ward, ward),
      department = COALESCE(p_department, department),
      designation = COALESCE(p_designation, designation),
      phone = nullif(trim(p_phone), ''),
      role = COALESCE(p_role, role)
  WHERE id = p_staff_id
  RETURNING * INTO v_staff;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff record not found.';
  END IF;

  RETURN row_to_json(v_staff);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_staff FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_staff FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_update_staff TO authenticated;

NOTIFY pgrst, 'reload schema';
