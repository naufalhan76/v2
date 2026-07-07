import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/supabase-server'
import { ROUTE_ROLE_MATRIX } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const role = await getUserRole()
  const redirects = ROUTE_ROLE_MATRIX['/'].authenticatedRedirects
  const target = (role && redirects?.[role as keyof typeof redirects]) || '/dashboard'
  redirect(target)
}
