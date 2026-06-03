import type { Metadata, Viewport } from 'next'
import { BottomTabBar } from '@/components/technician/bottom-tab-bar'
import { TechnicianShell } from '@/components/technician/technician-shell'
import { ServiceWorkerRegister } from './sw-register'

export const metadata: Metadata = {
  title: 'MSN Tech',
  description: 'MSN ERP - Aplikasi Teknisi',
  manifest: '/technician-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MSN Tech',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
}

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ServiceWorkerRegister />

      {/* Main content area — bottom bar auto-hides on /complete routes */}
      <main className="flex-1 overflow-y-auto pb-20">
        <TechnicianShell>{children}</TechnicianShell>
      </main>

      <BottomTabBar />
    </div>
  )
}
