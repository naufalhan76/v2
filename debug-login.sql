-- Debug Login Issues
-- Run this in Supabase SQL Editor to check user data

-- 1. Check all users in auth.users
SELECT 
  id as auth_user_id,
  email,
  created_at,
  confirmed_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Check all users in user_management
SELECT 
  user_id,
  auth_user_id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM user_management
ORDER BY created_at DESC;

-- 3. Find users in auth.users but NOT in user_management (orphaned users)
SELECT 
  au.id as auth_user_id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN user_management um ON au.id = um.auth_user_id
WHERE um.auth_user_id IS NULL;

-- 4. Find users in user_management with NULL auth_user_id
SELECT 
  user_id,
  email,
  full_name,
  role,
  is_active
FROM user_management
WHERE auth_user_id IS NULL;

-- 5. Check specific user by email (REPLACE 'your-email@example.com' with your email)
-- SELECT 
--   au.id as auth_user_id,
--   au.email as auth_email,
--   um.user_id,
--   um.email as management_email,
--   um.full_name,
--   um.role,
--   um.is_active
-- FROM auth.users au
-- LEFT JOIN user_management um ON au.id = um.auth_user_id
-- WHERE au.email = 'your-email@example.com';
