-- Check user profile data
SELECT 
  user_id,
  email,
  full_name,
  role,
  photo_url,
  created_at,
  updated_at
FROM user_management
WHERE email = 'naufal.hanafi@agriaku.com';

-- Check auth.users metadata
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE email = 'naufal.hanafi@agriaku.com';
