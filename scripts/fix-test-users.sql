-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- It inserts the 4 test users into public.users and assigns their roles.
-- Requires: pm1, sales1, employee1, accountant users already exist in auth.users
--           (they were created by npm run seed:users)

DO $$
DECLARE
  v_pm_id       uuid;
  v_sales_id    uuid;
  v_employee_id uuid;
  v_account_id  uuid;

  v_pm_role     uuid;
  v_sales_role  uuid;
  v_emp_role    uuid;
  v_acc_role    uuid;
BEGIN
  -- Resolve auth user IDs by email
  SELECT id INTO v_pm_id       FROM auth.users WHERE email = 'pm1@markition.com'         LIMIT 1;
  SELECT id INTO v_sales_id    FROM auth.users WHERE email = 'sales1@markition.com'       LIMIT 1;
  SELECT id INTO v_employee_id FROM auth.users WHERE email = 'employee1@markition.com'    LIMIT 1;
  SELECT id INTO v_account_id  FROM auth.users WHERE email = 'accountant@markition.com'   LIMIT 1;

  IF v_pm_id IS NULL THEN RAISE EXCEPTION 'pm1@markition.com not found in auth.users — run seed:users first'; END IF;
  IF v_sales_id IS NULL THEN RAISE EXCEPTION 'sales1@markition.com not found in auth.users'; END IF;
  IF v_employee_id IS NULL THEN RAISE EXCEPTION 'employee1@markition.com not found in auth.users'; END IF;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'accountant@markition.com not found in auth.users'; END IF;

  -- Resolve role IDs
  SELECT id INTO v_pm_role     FROM app_roles WHERE name ILIKE 'Project Manager'  LIMIT 1;
  SELECT id INTO v_sales_role  FROM app_roles WHERE name ILIKE 'Sales Executive'  LIMIT 1;
  SELECT id INTO v_emp_role    FROM app_roles WHERE name ILIKE 'Employee'          LIMIT 1;
  SELECT id INTO v_acc_role    FROM app_roles WHERE name ILIKE 'Accountant'        LIMIT 1;

  IF v_pm_role IS NULL THEN RAISE EXCEPTION 'Role "Project Manager" not found in app_roles'; END IF;
  IF v_sales_role IS NULL THEN RAISE EXCEPTION 'Role "Sales Executive" not found in app_roles'; END IF;
  IF v_emp_role IS NULL THEN RAISE EXCEPTION 'Role "Employee" not found in app_roles'; END IF;
  IF v_acc_role IS NULL THEN RAISE EXCEPTION 'Role "Accountant" not found in app_roles'; END IF;

  -- Upsert into public.users (required by user_roles FK)
  INSERT INTO public.users (id, first_name, last_name, display_name, active)
  VALUES
    (v_pm_id,       'Alice',  '(PM)',         'Alice (PM)',         true),
    (v_sales_id,    'Bob',    '(Sales Exec)', 'Bob (Sales Exec)',   true),
    (v_employee_id, 'Carol',  '(Employee)',   'Carol (Employee)',   true),
    (v_account_id,  'David',  '(Accountant)', 'David (Accountant)', true)
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        active       = true;

  -- Upsert profiles (belt-and-suspenders, seed script may have already done this)
  INSERT INTO public.profiles (id, user_id, email, full_name, active, is_active, status)
  VALUES
    (v_pm_id,       v_pm_id,       'pm1@markition.com',         'Alice (PM)',         true, true, 'active'),
    (v_sales_id,    v_sales_id,    'sales1@markition.com',       'Bob (Sales Exec)',   true, true, 'active'),
    (v_employee_id, v_employee_id, 'employee1@markition.com',    'Carol (Employee)',   true, true, 'active'),
    (v_account_id,  v_account_id,  'accountant@markition.com',   'David (Accountant)', true, true, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Assign roles
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES
    (v_pm_id,       v_pm_role),
    (v_sales_id,    v_sales_role),
    (v_employee_id, v_emp_role),
    (v_account_id,  v_acc_role)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE 'Done — all 4 test users inserted into public.users and assigned roles.';
END $$;
