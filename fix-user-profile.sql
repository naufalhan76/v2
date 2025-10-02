-- Option 1: Update existing user (RECOMMENDED)
UPDATE user_management
SET 
  role = 'SUPERADMIN',
  full_name = 'Naufal Hanafi',
  updated_at = NOW()
WHERE email = 'naufal.hanafi@agriaku.com';

-- Verify
SELECT * FROM user_management WHERE email = 'naufal.hanafi@agriaku.com';

-- Option 2: Delete and let it auto-create (if Option 1 doesn't work)
-- DELETE FROM user_management WHERE email = 'naufal.hanafi@agriaku.com';
-- Then refresh profile page, it will auto-create with email prefix as name
