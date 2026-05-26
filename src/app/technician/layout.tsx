import type { Metadata, Viewport } from 'next'
import { BottomTabBar } from '@/components/technician/bottom-tab-bar'
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
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
}

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Service worker registration */}
      <ServiceWorkerRegister />

      {/* Main content area — scrollable, padded for bottom bar */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="mx-auto max-w-md px-4 py-4">
          {children}
        </div>
      </main>

      {/* Fixed bottom tab bar */}
      <BottomTabBar />
    </div>
  )
}
