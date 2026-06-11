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
  themeColor: '#1e1b5e',
}

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[max(884px,100dvh)] flex-col bg-bg-gray-faded">
      <ServiceWorkerRegister />

      {/* Main content area — bottom bar auto-hides on /complete routes */}
      <main className="flex-1 overflow-y-auto pb-safe">
        <TechnicianShell>{children}</TechnicianShell>
      </main>

      <BottomTabBar />
    </div>
  )
}
