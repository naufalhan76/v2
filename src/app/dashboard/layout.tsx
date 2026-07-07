import { redirect } from 'next/navigation'
import { DashboardShell } from './dashboard-shell'
import { getUserRole } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()
  if (role === 'TECHNICIAN') {
    redirect('/technician')
  }
  return <DashboardShell>{children}</DashboardShell>
}
