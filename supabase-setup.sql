-- =====================================================
-- SUPABASE DATABASE SETUP
-- Auto-populate user_management table from auth.users
-- =====================================================

-- Step 0: Add auth_user_id column if not exists (to link with auth.users)
ALTER TABLE public.user_management 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 1: Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_management (
    auth_user_id,
    email,
    full_name,
    role,
    last_login,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'ADMIN',
    NOW(),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Backfill existing users
INSERT INTO public.user_management (auth_user_id, email, full_name, role, last_login, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  'ADMIN' as role,
  NOW() as last_login,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.user_management um ON au.id = um.auth_user_id
WHERE um.auth_user_id IS NULL;

-- Step 4: Verify the setup
SELECT 
  'Total users in auth.users:' as description,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Total users in user_management:' as description,
  COUNT(*) as count
FROM public.user_management;

-- =====================================================
-- OPTIONAL: Update RLS Policies
-- =====================================================

-- Enable RLS on user_management table
ALTER TABLE public.user_management ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
DROP POLICY IF EXISTS "Users can view own data" ON public.user_management;
CREATE POLICY "Users can view own data"
  ON public.user_management
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Policy: SUPERADMIN can view all users
DROP POLICY IF EXISTS "SUPERADMIN can view all users" ON public.user_management;
CREATE POLICY "SUPERADMIN can view all users"
  ON public.user_management
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_management
      WHERE auth_user_id = auth.uid() AND role = 'SUPERADMIN'
    )
  );

-- Policy: SUPERADMIN can update users
DROP POLICY IF EXISTS "SUPERADMIN can update users" ON public.user_management;
CREATE POLICY "SUPERADMIN can update users"
  ON public.user_management
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_management
      WHERE auth_user_id = auth.uid() AND role = 'SUPERADMIN'
    )
  );

-- Policy: System can insert (untuk trigger)
DROP POLICY IF EXISTS "System can insert users" ON public.user_management;
CREATE POLICY "System can insert users"
  ON public.user_management
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Script ini akan menambah kolom 'auth_user_id' (UUID) ke tabel user_management
-- 2. Kolom 'user_id' (integer) tetap ada sebagai primary key
-- 3. Setiap user baru yang daftar akan otomatis masuk ke user_management dengan role ADMIN
-- 4. Jika mau ubah default role, ganti 'ADMIN' di function handle_new_user()
-- 5. SUPERADMIN harus dibuat manual pertama kali dengan:
--    UPDATE user_management SET role = 'SUPERADMIN' WHERE email = 'admin@example.com';
-- =====================================================
