'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  UserPlus,
  Wrench,
  LogIn,
  KeyRound,
  UserX,
  Shield,
  AlertCircle,
} from 'lucide-react'

export function AccountFlowTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Identitas &amp; Role</CardTitle>
              <CardDescription>
                Semua user login lewat Supabase Auth. Tidak ada anonymous sign-up;
                admin yang selalu membuat akun baru.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Ada 4 role: <Badge>SUPERADMIN</Badge> <Badge>ADMIN</Badge>{' '}
            <Badge>FINANCE</Badge> <Badge variant="secondary">TECHNICIAN</Badge>.
            Role disimpan di tabel <code>user_management</code>, sedangkan
            password dan session disimpan di Supabase Auth.
          </p>
          <p className="text-muted-foreground">
            Teknisi punya data tambahan (nomor kontak, perusahaan) di tabel{' '}
            <code>technicians</code>. Tabel ini dibuat bersamaan dengan{' '}
            <code>user_management</code> saat onboarding teknisi.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <UserPlus className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Buat Akun Staff (Admin / Finance)</CardTitle>
              <CardDescription>
                Menu: <strong>Pengaturan → Users → + Tambah User</strong>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-1">
            <li>Isi email, nama lengkap, role, password</li>
            <li>Klik <strong>Buat</strong></li>
            <li>
              Sistem otomatis:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                <li>Buat user di Supabase Auth (password ter-hash bcrypt)</li>
                <li>Insert row di <code>user_management</code> dengan role</li>
              </ul>
            </li>
            <li>
              Karena <code>email_confirm: true</code>, user langsung aktif —
              tidak perlu klik link verifikasi
            </li>
            <li>Share kredensial ke user (via WhatsApp /电话 saja, bukan email)</li>
          </ol>
          <div className="flex gap-2 rounded-md border bg-blue-50 dark:bg-blue-950/30 p-3">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-900 dark:text-blue-200">
              <strong>Catatan:</strong> Akun <code>SUPERADMIN</code> tidak bisa
              dibuat dari dashboard. Hanya via{' '}
              <code>scripts/bootstrap-staging.mjs</code> untuk mencegah
              akun superadmin non-prod bocor.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Onboard Teknisi</CardTitle>
              <CardDescription>
                Menu: <strong>Manajemen → Teknisi → + Tambah Teknisi</strong>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-1">
            <li>Isi data teknisi: email, nama, kontak, perusahaan</li>
            <li>Klik <strong>Simpan</strong></li>
            <li>
              Sistem menjalankan <strong>saga pattern</strong>:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                <li>
                  Step 1: Buat user di Supabase Auth (auth_user_id UUID
                  ter-allocate)
                </li>
                <li>
                  Step 2: Insert <code>user_management</code> dengan role
                  TECHNICIAN
                </li>
                <li>
                  Step 3: Insert <code>technicians</code> dengan
                  contact_number, company, dll
                </li>
              </ul>
            </li>
            <li>
              <strong>Rollback otomatis</strong> jika ada step yang gagal:
              hapus row di <code>user_management</code> + hapus user di
              Supabase Auth, agar tidak ada user orphan
            </li>
            <li>Teknisi login di <code>/technician</code> (bukan <code>/dashboard</code>)</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <LogIn className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Login</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            1. Buka <code>https://v2.nufnh.my.id/login</code>
          </p>
          <p>
            2. Input email + password → <code>supabase.auth.signInWithPassword</code>
          </p>
          <p>
            3. JWT disimpan di <strong>HTTP-only cookie</strong> (aman dari
            XSS). Middleware baca cookie ini di setiap request.
          </p>
          <p>
            4. Redirect otomatis:
            <ul className="list-disc list-inside ml-6 mt-1">
              <li>SUPERADMIN / ADMIN / FINANCE → <code>/dashboard</code></li>
              <li>TECHNICIAN → <code>/technician</code></li>
            </ul>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Reset Password</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            1. Halaman login → klik link <strong>&quot;Lupa password?&quot;</strong>
          </p>
          <p>
            2. Input email → Supabase Auth kirim email reset link (via SMTP
            Resend, kalau sudah dikonfigurasi — lihat tab Setup OpenWA →
            panduan SMTP Resend)
          </p>
          <p>
            3. User klik link di email → masuk password baru → otomatis login
          </p>
          <div className="flex gap-2 rounded-md border bg-yellow-50 dark:bg-yellow-950/30 p-3">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-900 dark:text-yellow-200">
              Tanpa konfigurasi SMTP, email reset tidak akan terkirim. Lo bisa
              reset manual via dashboard Supabase (Auth → Users → pilih user →
              &quot;Send password recovery&quot;).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <UserX className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <CardTitle>Nonaktifkan vs Hapus</CardTitle>
              <CardDescription>
                Dua cara berbeda untuk &quot;melepas&quot; user. Pilih sesuai situasi.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Badge variant="outline" className="mb-2">
              Nonaktifkan (recommended)
            </Badge>
            <p>
              Set <code>is_active = false</code>. Sesi aktif di-invalidate
              otomatis (user langsung logout). Riwayat order / invoice tetap
              tersimpan.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Pakai ini untuk: teknisi resign, admin cuti panjang, dll.
            </p>
          </div>
          <Separator />
          <div>
            <Badge variant="destructive" className="mb-2">
              Hapus permanen
            </Badge>
            <p>
              Hapus dari Supabase Auth + <code>user_management</code>. TIDAK
              bisa di-undo. Akan ada broken FK reference kalau user pernah
              buat order / invoice.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Hanya untuk: akun salah-create yang tidak pernah dipakai
              (tidak ada order, tidak ada invoice).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
