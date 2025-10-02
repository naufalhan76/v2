-- Delete duplicate entries (yang baru ke-create salah)
-- Keep only the ones with user_id = MSN0000 and MSN0001

DELETE FROM user_management
WHERE auth_user_id IN (
  '9177d9cc-c89a-4687-a172-8b73864884af',
  'a326545b-a323-4c70-abf4-b31ab625adc5'
)
AND user_id NOT IN ('MSN0000', 'MSN0001');

-- Verify only 2 users remain
SELECT 
  user_id,
  auth_user_id,
  full_name,
  email,
  role
FROM user_management
ORDER BY created_at;
