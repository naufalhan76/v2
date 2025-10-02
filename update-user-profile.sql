-- Update existing user profile with correct role and full_name
UPDATE user_management
SET 
  role = 'SUPERADMIN',
  full_name = 'Naufal Hanafi',  -- Ganti dengan nama lu
  updated_at = NOW()
WHERE email = 'naufal.hanafi@agriaku.com';

-- Verify update
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
