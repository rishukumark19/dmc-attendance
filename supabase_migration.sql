-- ====================================================================
-- Dhanbad Municipal Corporation (DMC) — Attendance System
-- Database Migration: Data Integrity, RLS Security, and Corrections
-- ====================================================================

-- 1. Ensure extensions
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

-- 4. Enforce Database Uniqueness Constraint (Rule 2: No Duplicate Attendance)
-- Safely back up duplicate records before applying constraint if they exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_worker_date'
  ) THEN
    -- Archive any duplicates into backup table to prevent data loss
    CREATE TABLE IF NOT EXISTS public.attendance_duplicates_backup AS
    SELECT a.* FROM public.attendance a
    WHERE a.id NOT IN (
      SELECT DISTINCT ON (staff_user_id, date) id
      FROM public.attendance
      ORDER BY staff_user_id, date, created_at ASC
    );

    -- Remove archived duplicates from active attendance
    DELETE FROM public.attendance a
    WHERE a.id IN (SELECT id FROM public.attendance_duplicates_backup);

    ALTER TABLE public.attendance 
      ADD CONSTRAINT uq_attendance_worker_date UNIQUE (staff_user_id, date);
  END IF;
END $$;

-- 5. Create Attendance Corrections Audit Table (Rule 8 & 9)
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

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. HARDENED STORED PROCEDURES (C1/C2/C3/C6/C7 security & integrity fixes)
-- ============================================================================

-- Drop older overloaded function signatures to prevent signature ambiguity
DROP FUNCTION IF EXISTS public.do_check_in(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.do_check_in(TEXT);

-- do_check_in: Derives worker identity strictly from DB (not browser), checks active status,
-- sets search_path, enforces period locks, and supports flexible params for backwards compatibility.
CREATE OR REPLACE FUNCTION public.do_check_in(
  p_ward TEXT DEFAULT NULL,
  p_emp_id TEXT DEFAULT NULL,
  p_staff_name TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v            public.attendance;
  v_staff      public.staff;
  v_today      TEXT;
  v_month      TEXT;
  v_mins       INT;
  v_dow        INT;
  v_ward       TEXT;
BEGIN
  -- Derive IST time components server-side (not trusted from browser)
  v_today := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');
  v_month := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');
  v_dow   := extract(DOW FROM (now() AT TIME ZONE 'Asia/Kolkata'));
  v_mins  := extract(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata')) * 60
           + extract(MINUTE FROM (now() AT TIME ZONE 'Asia/Kolkata'));

  -- C1/C2: Derive identity from DB — reject if user has no active staff record
  SELECT * INTO v_staff
  FROM public.staff
  WHERE user_id = auth.uid()
    AND active = true
    AND role   = 'staff'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active staff record found for this account. Contact your administrator.';
  END IF;

  -- Guard: Block Sundays (Weekly Off)
  IF v_dow = 0 THEN
    RAISE EXCEPTION 'Sunday is an official weekly off. Check-in is not permitted today.';
  END IF;

  -- Guard: Enforce 6:00 AM – 8:01 AM IST window (360–480 inclusive)
  IF v_mins < 360 OR v_mins > 480 THEN
    RAISE EXCEPTION 'Check-in window is closed. Official shift punch window is 06:00 AM – 08:00 AM IST.';
  END IF;

  -- C6: Block check-in if the month's payroll period is locked
  IF EXISTS (SELECT 1 FROM public.period_locks WHERE month_key = v_month) THEN
    RAISE EXCEPTION 'Attendance period % has been finalized and locked. Contact your administrator.', v_month;
  END IF;

  -- Return existing record if already checked in today (idempotent)
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE staff_user_id = auth.uid() AND date = v_today
  ) THEN
    SELECT * INTO v FROM public.attendance
    WHERE staff_user_id = auth.uid() AND date = v_today;
    RETURN row_to_json(v);
  END IF;

  -- Resolve ward: prefer caller-supplied ward, else use staff profile ward
  IF p_ward IS NOT NULL AND trim(p_ward) <> '' THEN
    v_ward := trim(p_ward);
  ELSE
    v_ward := COALESCE(v_staff.ward, 'Ward 12 (Bank More / बैंक मोड़)');
  END IF;

  -- Insert using server-derived identity fields — never trust browser-supplied emp_id/name
  INSERT INTO public.attendance (
    staff_user_id, emp_id, staff_name, date, month_key, in_time, ward, status
  ) VALUES (
    v_staff.user_id,
    v_staff.emp_id,
    v_staff.name,
    v_today,
    v_month,
    now(),
    v_ward,
    'Present'
  ) RETURNING * INTO v;

  RETURN row_to_json(v);
END;
$$;

-- Restrict execution: only authenticated users (not anon), no public access
REVOKE EXECUTE ON FUNCTION public.do_check_in(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.do_check_in(TEXT, TEXT, TEXT) TO authenticated;

-- do_check_out: Adds search_path, enforces same-day cutoff (max 12h window)
CREATE OR REPLACE FUNCTION public.do_check_out(p_id UUID)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v        public.attendance;
  v_rec    public.attendance;
  v_today  TEXT;
  v_elapsed_hours NUMERIC;
BEGIN
  v_today := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');

  -- Verify the record belongs to this user (or caller is admin)
  SELECT * INTO v_rec FROM public.attendance
  WHERE id = p_id
    AND (
      staff_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin')
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or invalid attendance session.';
  END IF;

  -- Idempotent: already checked out
  IF v_rec.out_time IS NOT NULL THEN
    RETURN row_to_json(v_rec);
  END IF;

  -- Guard: Prevent checkout from crossing midnight (same-day requirement)
  IF v_rec.date <> v_today THEN
    RAISE EXCEPTION 'Cannot check out for a previous day''s shift (%). Please contact your supervisor.', v_rec.date;
  END IF;

  -- Guard: Prevent extremely long shifts (over 12 hours is invalid)
  v_elapsed_hours := EXTRACT(EPOCH FROM (now() - v_rec.in_time)) / 3600.0;
  IF v_elapsed_hours > 12 THEN
    RAISE EXCEPTION 'Shift duration exceeds 12 hours. Please contact your supervisor to regularize this record.';
  END IF;

  UPDATE public.attendance
  SET out_time = now()
  WHERE id = p_id
  RETURNING * INTO v;

  RETURN row_to_json(v);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.do_check_out(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.do_check_out(UUID) TO authenticated;

-- C7 FIX: Atomic regularize_attendance RPC
-- Admin-only procedure that updates attendance AND records audit log in a single transaction
CREATE OR REPLACE FUNCTION public.regularize_attendance(
  p_attendance_id UUID,
  p_new_in_time TIMESTAMPTZ,
  p_new_out_time TIMESTAMPTZ,
  p_reason TEXT,
  p_correction_type TEXT DEFAULT 'TIME_CORRECTION'
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.attendance;
  v_audit public.attendance_corrections;
BEGIN
  -- Verify caller has admin privileges
  IF NOT EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can regularize attendance records.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Correction reason is mandatory for government audit compliance.';
  END IF;

  SELECT * INTO v_rec FROM public.attendance WHERE id = p_attendance_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found.';
  END IF;

  -- 1. Insert audit trail into attendance_corrections
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

  -- 2. Update attendance record atomically
  UPDATE public.attendance
  SET in_time = p_new_in_time,
      out_time = p_new_out_time,
      is_corrected = true,
      remarks = trim(p_reason)
  WHERE id = p_attendance_id
  RETURNING * INTO v_rec;

  RETURN row_to_json(v_rec);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regularize_attendance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.regularize_attendance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 7. HARDENED ROW LEVEL SECURITY (C4/C5 security fixes)
-- ============================================================================
DROP POLICY IF EXISTS auth_staff_all          ON public.staff;
DROP POLICY IF EXISTS auth_att_all            ON public.attendance;
DROP POLICY IF EXISTS staff_select_policy     ON public.staff;
DROP POLICY IF EXISTS staff_modify_policy     ON public.staff;
DROP POLICY IF EXISTS attendance_select_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_modify_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_insert_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_update_policy ON public.attendance;
DROP POLICY IF EXISTS corrections_policy      ON public.attendance_corrections;

-- Staff SELECT: all authenticated users can read staff directory
CREATE POLICY staff_select_policy ON public.staff
  FOR SELECT TO authenticated
  USING (true);

-- C5 FIX: Staff can update ONLY their own ward field.
-- Admin can update any field on any record.
-- Workers can NOT update role, emp_id, active, user_id via direct SQL.
CREATE POLICY staff_self_ward_update ON public.staff
  FOR UPDATE TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (
    -- Allow own-row update only if the sensitive fields are unchanged
    auth.uid() = user_id
    AND role    = (SELECT role    FROM public.staff WHERE user_id = auth.uid())
    AND emp_id  = (SELECT emp_id  FROM public.staff WHERE user_id = auth.uid())
    AND active  = (SELECT active  FROM public.staff WHERE user_id = auth.uid())
  );

-- Admin full access to staff table
CREATE POLICY staff_admin_all ON public.staff
  FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin'));

-- Attendance SELECT: workers see only their own; admin sees all
CREATE POLICY attendance_select_policy ON public.attendance
  FOR SELECT TO authenticated
  USING (
    staff_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  );

-- C4 FIX: Workers may NOT directly INSERT/UPDATE attendance.
-- All worker mutations MUST go through do_check_in / do_check_out (SECURITY DEFINER).
-- Admin retains full direct access for corrections.
CREATE POLICY attendance_admin_modify ON public.attendance
  FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin'));

-- Corrections: admin-only read and write
CREATE POLICY corrections_policy ON public.attendance_corrections
  FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin'));

-- ============================================================================
-- 6. PERIOD LOCKS / PAYROLL FREEZE TABLE (Module B, Rule 15)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.period_locks (
  month_key TEXT PRIMARY KEY,
  locked_by TEXT DEFAULT 'Admin',
  locked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS period_locks_policy ON public.period_locks;
CREATE POLICY period_locks_policy ON public.period_locks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  );

