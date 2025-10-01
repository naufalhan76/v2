# Supabase Setup Guide - User Management Automation

## Masalah yang Diperbaiki

1. ✅ User yang daftar tidak otomatis dapat role
2. ✅ Data dari auth.users tidak masuk ke tabel user_management

## Cara Setup

### Option 1: Melalui Supabase Dashboard (Recommended)

1. Buka **Supabase Dashboard**: https://supabase.com/dashboard
2. Pilih project: **ybxnosmcjubuezefofko**
3. Klik menu **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy paste isi file `supabase-setup.sql` ke editor
6. Klik **Run** atau tekan `Ctrl+Enter`
7. ✅ Selesai!

### Option 2: Melalui Terminal (Alternatif)

```bash
# Install Supabase CLI jika belum ada
npm install -g supabase

# Login ke Supabase
supabase login

# Link ke project
supabase link --project-ref ybxnosmcjubuezefofko

# Run SQL script
supabase db push
```

## Cara Kerja

### 1. Database Trigger
Setiap kali ada user baru di `auth.users`, trigger akan otomatis:
- Insert data ke tabel `user_management`
- Set role default: **ADMIN**
- Copy email dan full_name dari metadata

### 2. Backfill Existing Users
Script juga akan mengisi user yang sudah terdaftar sebelumnya tapi belum ada di `user_management`.

### 3. RLS Policies
Row Level Security policies sudah diatur:
- User bisa lihat data sendiri
- SUPERADMIN bisa lihat semua user
- SUPERADMIN bisa update user lain

## Testing

### Test 1: Register User Baru

1. Buka http://localhost:3000/register (setelah page dibuat)
2. Daftar dengan email baru
3. Check di Supabase Dashboard → Table Editor → `user_management`
4. User baru harus muncul dengan role **ADMIN**

### Test 2: Check Existing Users

```sql
-- Run di SQL Editor
SELECT 
  um.email,
  um.full_name,
  um.role,
  um.created_at
FROM user_management um
ORDER BY created_at DESC;
```

### Test 3: Verify Trigger

```sql
-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

## Membuat SUPERADMIN Pertama Kali

Setelah setup, buat SUPERADMIN dengan SQL:

```sql
-- Ganti email dengan email admin yang sudah terdaftar
UPDATE user_management 
SET role = 'SUPERADMIN' 
WHERE email = 'admin@example.com';
```

## Troubleshooting

### Error: "Error fetching user permissions"

**Penyebab**: RLS (Row Level Security) policy terlalu restrictive

**Solusi**: Run SQL script `fix-rls-policy.sql`

1. Buka **Supabase Dashboard** → SQL Editor
2. Copy paste isi file `fix-rls-policy.sql`
3. Klik **RUN** ▶️
4. Coba login lagi

Script ini akan:
- ✅ Membuat policy yang lebih permissive untuk authenticated users
- ✅ Memungkinkan semua user yang login bisa baca data user_management (untuk cek role)
- ✅ Hanya SUPERADMIN yang bisa update/delete user

### Error: "permission denied for table user_management"

**Solusi**: Pastikan RLS policies sudah di-apply dengan run ulang bagian RLS di `supabase-setup.sql`

### Error: "trigger already exists"

**Solusi**: Script sudah include `DROP TRIGGER IF EXISTS`, run ulang saja script-nya

### User baru tidak muncul di user_management

1. Check apakah trigger aktif:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

2. Check error di Supabase Logs:
   - Dashboard → Logs → Postgres Logs
   - Cari error message terkait trigger

### Existing users tidak ke-backfill

Run manual backfill query:
```sql
INSERT INTO public.user_management (id, email, full_name, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'ADMIN',
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.user_management um ON au.id = um.id
WHERE um.id IS NULL;
```

## Ubah Default Role

Jika mau user baru dapat role selain ADMIN, edit function:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_management (
    id, email, full_name, role, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'TEKNISI', -- Ganti role default di sini
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Next Steps

Setelah setup Supabase:

1. ✅ Test register user baru
2. ✅ Verify data masuk ke user_management
3. ✅ Test login dengan user baru
4. ✅ Create SUPERADMIN untuk akses penuh
5. 🔜 Buat register page di Next.js
6. 🔜 Test role-based access di middleware

## References

- [Supabase Triggers](https://supabase.com/docs/guides/database/postgres/triggers)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
