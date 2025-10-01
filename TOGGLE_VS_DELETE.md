# User Management: Toggle vs Delete

## Perbedaan Toggle Status dan Delete

### 🟢 Toggle Status (Switch)

**Fungsi:**
- Mengubah status `is_active` antara `TRUE` dan `FALSE`
- Data user **tetap ada** di database
- User **tidak bisa login** saat status nonaktif (`is_active = FALSE`)
- User **bisa diaktifkan kembali** kapan saja

**Kapan Digunakan:**
- User cuti/libur sementara
- User dipindahkan ke divisi lain tapi mungkin kembali
- Testing: disable user tanpa menghapus data
- Suspend user karena pelanggaran (bisa unsuspend nanti)

**Database Impact:**
```sql
-- Toggle ON (aktifkan)
UPDATE user_management 
SET is_active = TRUE, updated_at = NOW() 
WHERE user_id = 'MSN0001';

-- Toggle OFF (nonaktifkan)
UPDATE user_management 
SET is_active = FALSE, updated_at = NOW() 
WHERE user_id = 'MSN0001';
```

**UI:**
- Switch component (ON/OFF)
- Warna: Blue/Gray
- Lokasi: Kolom "Status"
- Label: "Aktif" / "Nonaktif"

**Toast Message:**
- Success: "User berhasil diaktifkan" / "User berhasil dinonaktifkan"

---

### 🔴 Delete (Trash Button)

**Fungsi:**
- **Hapus permanen** dari database (`DELETE` row)
- Hapus juga dari Supabase Auth
- User **tidak bisa login** karena tidak ada lagi
- User **tidak bisa diaktifkan kembali** (data hilang permanent)
- Riwayat aktivitas user juga hilang

**Kapan Digunakan:**
- User resign/keluar perusahaan (permanent)
- User duplicate atau kesalahan input
- User testing yang tidak diperlukan lagi
- Cleanup data lama

**Database Impact:**
```sql
-- Hapus dari user_management
DELETE FROM user_management WHERE user_id = 'MSN0001';

-- Hapus dari auth.users (via admin API)
supabaseAdmin.auth.admin.deleteUser(auth_user_id)
```

**UI:**
- Trash icon button
- Warna: Red (destructive)
- Lokasi: Kolom "Aksi"
- Label: "Hapus"

**Confirmation Dialog:**
- Title: "Hapus User Permanen"
- Warning: Data hilang permanen, tidak bisa dikembalikan
- Suggestion: Gunakan toggle jika hanya ingin nonaktifkan sementara
- Button: "Ya, Hapus Permanen" (Red)

**Toast Message:**
- Success: "User berhasil dihapus dari sistem"
- Error: "Gagal menghapus user"

---

## Perbandingan

| Feature | Toggle Status | Delete |
|---------|--------------|--------|
| **Data di Database** | ✅ Tetap ada | ❌ Dihapus |
| **User bisa login?** | ❌ Tidak (jika nonaktif) | ❌ Tidak (tidak ada) |
| **Bisa diaktifkan lagi?** | ✅ Ya | ❌ Tidak |
| **Riwayat data** | ✅ Tetap ada | ❌ Hilang |
| **Reversible?** | ✅ Ya (toggle lagi) | ❌ Tidak |
| **Auth record** | ✅ Tetap ada | ❌ Dihapus |
| **Use case** | Temporary disable | Permanent removal |

---

## User Flow

### Toggle Status Flow:

```
User klik switch
    ↓
Langsung update is_active
    ↓
Toast notification
    ↓
Refresh user list
    ↓
Status berubah (Aktif ↔ Nonaktif)
```

**Cepat, tidak ada konfirmasi** (reversible)

---

### Delete Flow:

```
User klik tombol Hapus
    ↓
Dialog konfirmasi muncul
    ↓
User baca warning
    ↓
User klik "Ya, Hapus Permanen"
    ↓
Loading state
    ↓
DELETE dari database
    ↓
DELETE dari auth
    ↓
Toast notification
    ↓
Refresh user list
    ↓
User hilang dari daftar
```

**Butuh konfirmasi** (tidak reversible)

---

## Code Implementation

### Toggle Status:

```typescript
// Action
export async function toggleUserStatus(userId: string, newStatus: boolean) {
  const { error } = await supabase
    .from('user_management')
    .update({ 
      is_active: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  // ...
}

// UI Component
<Switch
  checked={user.is_active}
  onCheckedChange={() => handleToggleStatus(user.user_id, user.is_active)}
/>
```

### Delete:

```typescript
// Action
export async function deleteUser(userId: string) {
  // Get auth_user_id
  const { data: userData } = await supabase
    .from('user_management')
    .select('auth_user_id')
    .eq('user_id', userId)
    .single()

  // Delete from database
  await supabase
    .from('user_management')
    .delete()
    .eq('user_id', userId)

  // Delete from auth
  await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id)
  // ...
}

// UI Component
<Button
  variant="outline"
  size="icon"
  onClick={() => handleDelete(user.user_id)}
>
  <Trash2 className="h-4 w-4" />
</Button>

// With confirmation dialog
<AlertDialog open={isDeleteDialogOpen}>
  <AlertDialogContent>
    <AlertDialogTitle>Hapus User Permanen</AlertDialogTitle>
    <AlertDialogDescription>
      Peringatan: Data akan hilang permanen
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Batal</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>
        Ya, Hapus Permanen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Security & Best Practices

### Toggle Status:
✅ **Recommended untuk:**
- User sementara tidak aktif
- Testing dan debugging
- Suspend temporary
- Quick enable/disable

⚠️ **Catatan:**
- User masih bisa dilihat di list
- Data dan riwayat tetap ada
- Middleware akan block login jika is_active = false

### Delete:
⚠️ **Use with caution:**
- Permanent action, tidak bisa undo
- Data hilang selamanya
- Perlu konfirmasi dialog
- Log the action untuk audit

✅ **Best practice:**
- Require SUPERADMIN role
- Add confirmation dialog dengan warning jelas
- Log ke audit table (jika ada)
- Consider soft delete untuk data penting
- Backup data sebelum delete massive

---

## Testing Checklist

### Toggle Status:
- [ ] Klik switch OFF → User jadi nonaktif, tidak bisa login
- [ ] Klik switch ON → User jadi aktif, bisa login
- [ ] Toast notification muncul
- [ ] Status berubah di UI tanpa refresh
- [ ] Middleware block login user nonaktif

### Delete:
- [ ] Klik tombol Hapus → Dialog muncul
- [ ] Dialog menampilkan warning yang jelas
- [ ] Klik "Batal" → Dialog close, tidak ada perubahan
- [ ] Klik "Ya, Hapus Permanen" → Loading state
- [ ] User dihapus dari database
- [ ] User dihapus dari auth.users
- [ ] Toast notification muncul
- [ ] User hilang dari list
- [ ] User tidak bisa login (karena tidak ada)

---

## Summary

**Toggle = Temporary** 🔄
- Nonaktifkan/aktifkan user sementara
- Data tetap ada
- Bisa diaktifkan kembali
- Quick action tanpa konfirmasi

**Delete = Permanent** 🗑️
- Hapus user selamanya
- Data hilang permanen
- Tidak bisa dikembalikan
- Butuh konfirmasi dengan warning

**Golden Rule:** 
> Jika ragu apakah akan butuh data user di masa depan, gunakan **Toggle Status** dulu. Hanya gunakan **Delete** jika benar-benar yakin data tidak akan dibutuhkan lagi.
