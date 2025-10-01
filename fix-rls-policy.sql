-- =====================================================
-- FIX RLS POLICY - User Management
-- Run this if getting "Error fetching user permissions"
-- =====================================================

-- Option 1: TEMPORARY - Disable RLS for testing (NOT for production!)
-- ALTER TABLE public.user_management DISABLE ROW LEVEL SECURITY;

-- Option 2: RECOMMENDED - Fix RLS policies to be more permissive for authenticated users

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own data" ON public.user_management;
DROP POLICY IF EXISTS "SUPERADMIN can view all users" ON public.user_management;
DROP POLICY IF EXISTS "SUPERADMIN can update users" ON public.user_management;
DROP POLICY IF EXISTS "System can insert users" ON public.user_management;

-- Policy 1: Authenticated users can read their own data
CREATE POLICY "Authenticated users can view own data"
  ON public.user_management
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Policy 2: Authenticated users can read all users (for role checking)
-- This is needed for login to work properly
CREATE POLICY "Authenticated users can view all users"
  ON public.user_management
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 3: SUPERADMIN can update users
CREATE POLICY "SUPERADMIN can update users"
  ON public.user_management
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_management
      WHERE auth_user_id = auth.uid() AND role = 'SUPERADMIN'
    )
  );

-- Policy 4: SUPERADMIN can delete users
CREATE POLICY "SUPERADMIN can delete users"
  ON public.user_management
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_management
      WHERE auth_user_id = auth.uid() AND role = 'SUPERADMIN'
    )
  );

-- Policy 5: System can insert new users (for trigger)
CREATE POLICY "System can insert users"
  ON public.user_management
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'user_management'
ORDER BY policyname;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Policy "Authenticated users can view all users" allows any logged-in user to read user_management
-- 2. This is necessary for login flow to check user roles
-- 3. If you want more restrictive policies, you'll need to handle role checking differently
-- 4. Only SUPERADMIN can update/delete users
-- =====================================================
