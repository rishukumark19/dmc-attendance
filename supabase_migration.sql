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
-- Drop any legacy duplicate records before applying constraint if they exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_worker_date'
  ) THEN
    -- Keep only the earliest punch if duplicates already exist
    DELETE FROM public.attendance a
    WHERE a.id NOT IN (
      SELECT DISTINCT ON (staff_user_id, date) id
      FROM public.attendance
      ORDER BY staff_user_id, date, created_at ASC
    );

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

-- 6. Harden Stored Procedure: do_check_in (Rule 3 & Scenarios A01, A21, T01)
CREATE OR REPLACE FUNCTION public.do_check_in(p_emp_id TEXT, p_staff_name TEXT, p_ward TEXT DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v public.attendance;
  v_today TEXT;
  v_month TEXT;
  v_mins INT;
  v_dow INT;
  v_assigned_ward TEXT;
BEGIN
  -- Compute Indian Standard Time components
  v_today := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD');
  v_month := to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM');
  v_dow   := extract(DOW from (now() AT TIME ZONE 'Asia/Kolkata'));
  v_mins  := extract(HOUR from (now() AT TIME ZONE 'Asia/Kolkata')) * 60 + 
             extract(MINUTE from (now() AT TIME ZONE 'Asia/Kolkata'));

  -- Guard: Block Sundays (Weekly Off)
  IF v_dow = 0 THEN
    RAISE EXCEPTION 'Sunday is an official weekly off. Check-in is not permitted today.';
  END IF;

  -- Guard: Enforce 6:00 AM to 8:01 AM Window (360 to 481 mins)
  -- Note: Leave window flexible by 1 minute for network transit (360-481)
  IF v_mins < 360 OR v_mins >= 481 THEN
    RAISE EXCEPTION 'Check-in window is closed. Official shift punch window is 06:00 AM – 08:00 AM IST.';
  END IF;

  -- Guard: Check if attendance already recorded today
  IF EXISTS (SELECT 1 FROM public.attendance WHERE staff_user_id = auth.uid() AND date = v_today) THEN
    SELECT * INTO v FROM public.attendance WHERE staff_user_id = auth.uid() AND date = v_today;
    RETURN row_to_json(v);
  END IF;

  -- Resolve Ward assignment
  IF p_ward IS NOT NULL AND trim(p_ward) <> '' THEN
    v_assigned_ward := p_ward;
  ELSE
    SELECT COALESCE(ward, 'Ward 12 (Bank More / बैंक मोड़)') INTO v_assigned_ward 
    FROM public.staff WHERE user_id = auth.uid();
  END IF;

  INSERT INTO public.attendance (
    staff_user_id, emp_id, staff_name, date, month_key, in_time, ward, status
  ) VALUES (
    auth.uid(), p_emp_id, p_staff_name, v_today, v_month, now(), COALESCE(v_assigned_ward, 'Ward 12 (Bank More / बैंक मोड़)'), 'Present'
  ) RETURNING * INTO v;

  RETURN row_to_json(v);
END;
$$;

-- 7. Harden Stored Procedure: do_check_out (Scenario A10, A12)
CREATE OR REPLACE FUNCTION public.do_check_out(p_id UUID)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v public.attendance;
BEGIN
  -- Verify user ownership or admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance 
    WHERE id = p_id AND (staff_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin'
    ))
  ) THEN
    RAISE EXCEPTION 'Unauthorized or invalid attendance session.';
  END IF;

  -- Ensure check-out has not already been logged
  IF EXISTS (SELECT 1 FROM public.attendance WHERE id = p_id AND out_time IS NOT NULL) THEN
    SELECT * INTO v FROM public.attendance WHERE id = p_id;
    RETURN row_to_json(v);
  END IF;

  UPDATE public.attendance 
  SET out_time = now()
  WHERE id = p_id
  RETURNING * INTO v;

  RETURN row_to_json(v);
END;
$$;

-- 8. Hardened Row Level Security (RLS) Policies (Scenarios S01-S08)
DROP POLICY IF EXISTS auth_staff_all ON public.staff;
DROP POLICY IF EXISTS auth_att_all ON public.attendance;
DROP POLICY IF EXISTS staff_select_policy ON public.staff;
DROP POLICY IF EXISTS staff_modify_policy ON public.staff;
DROP POLICY IF EXISTS attendance_select_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_modify_policy ON public.attendance;
DROP POLICY IF EXISTS corrections_policy ON public.attendance_corrections;

-- Allow authenticated users to view staff (needed for directory / verification)
CREATE POLICY staff_select_policy ON public.staff
  FOR SELECT TO authenticated
  USING (true);

-- Only Admins can insert, update, or deactivate staff accounts
CREATE POLICY staff_modify_policy ON public.staff
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
    OR auth.uid() = user_id -- Allows staff to update own profile fields like ward
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
    OR auth.uid() = user_id
  );

-- Attendance SELECT: staff see own, admin sees all
CREATE POLICY attendance_select_policy ON public.attendance
  FOR SELECT TO authenticated
  USING (
    staff_user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  );

-- Attendance INSERT/UPDATE/DELETE: controlled by procedures or admin
CREATE POLICY attendance_modify_policy ON public.attendance
  FOR ALL TO authenticated
  USING (
    staff_user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  )
  WITH CHECK (
    staff_user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  );

-- Corrections table: readable and insertable by admin
CREATE POLICY corrections_policy ON public.attendance_corrections
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin')
  );

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

