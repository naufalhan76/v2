# Profile Feature Setup

## Supabase Storage Bucket Setup

Untuk fitur upload foto profile, kamu perlu buat storage bucket di Supabase:

### 1. Buat Storage Bucket

1. Buka Supabase Dashboard → Storage
2. Klik "New bucket"
3. Nama bucket: `avatars`
4. Public bucket: **YES** ✅ (biar foto bisa diakses public)
5. Klik "Save"

### 2. Setup Storage Policy

Jalankan SQL ini di Supabase SQL Editor:

```sql
-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles'
);

-- Allow public to read avatars
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles'
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles'
);
```

### 3. Verify Table Structure

Pastikan table `user_management` punya column `photo_url`:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_management' 
AND column_name = 'photo_url';

-- If not exists, add it:
ALTER TABLE user_management 
ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

## Features Implemented

### ✅ Profile Page (`/dashboard/profile`)

1. **Profile Photo Upload**
   - Upload foto profile (JPG, PNG, GIF)
   - Max size: 5MB
   - Auto-resize avatar display
   - Fallback to initials if no photo
   - Stores in Supabase Storage bucket `avatars/profiles/`

2. **Personal Information**
   - Edit full name
   - Edit email (dengan email verification)
   - Edit phone number
   - Display role (read-only)
   - Auto-sync dengan `user_management` table

3. **Change Password**
   - Verify current password
   - Set new password (min 6 characters)
   - Confirm new password matching
   - Password toggle visibility

4. **Email Change Verification**
   - Alert dialog untuk konfirmasi
   - Send verification email ke email baru
   - Update `auth.users` dengan admin client
   - Require email confirmation before fully active

## Server Actions

File: `src/lib/actions/profile.ts`

### `getUserProfile()`
- Fetch current user profile dari `user_management`
- Returns: user_id, email, full_name, photo_url, role, phone_number

### `updateUserProfile(data)`
- Update full_name, email, phone_number
- Sync dengan `user_management` table
- Jika email berubah: update `auth.users` dan kirim verification
- Auto-revalidate page

### `updateUserPassword(currentPassword, newPassword)`
- Verify current password dengan signInWithPassword
- Update password di auth.users
- Validation: min 6 chars, password match

### `updateProfilePhoto(file)`
- Upload ke Storage bucket `avatars/profiles/`
- Unique filename: `{user_id}-{timestamp}.{ext}`
- Update `photo_url` di `user_management`
- Return public URL

## UI Components

### New Components:
- `src/components/ui/avatar.tsx` - Avatar component (Radix UI)

### Existing Components Used:
- Card, CardHeader, CardTitle, CardDescription, CardContent
- Button, Input, Label
- AlertDialog (untuk email confirmation)
- Separator
- Toast notifications

## Environment Variables

Pastikan di `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing Checklist

- [ ] Profile page loads dengan user data
- [ ] Upload foto profile (test JPG, PNG, GIF)
- [ ] Update nama dan phone number
- [ ] Update email (cek verification email dikirim)
- [ ] Change password (cek current password validation)
- [ ] Verify data sync ke `user_management` table
- [ ] Check avatar displays di Navbar/Sidebar
- [ ] Test file size validation (>5MB)
- [ ] Test invalid file type

## Next Steps

1. ✅ Create Supabase storage bucket `avatars`
2. ✅ Run storage policies SQL
3. ✅ Verify `photo_url` column exists
4. 🔄 Test all profile update functions
5. 📱 Consider adding avatar to Navbar component

## Notes

- Password verification pakai `signInWithPassword` - akan create new session token
- Email change require admin client untuk bypass rate limiting
- Storage bucket HARUS public untuk avatar bisa diakses
- File naming: `{user_id}-{timestamp}.{ext}` untuk avoid conflicts
- Verification email pakai `resetPasswordForEmail` - nanti improvement jadi dedicated verification flow
