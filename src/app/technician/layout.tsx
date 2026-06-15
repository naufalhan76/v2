import type { Metadata, Viewport } from 'next'
import { Lexend } from 'next/font/google'
import { BottomTabBar } from '@/components/technician/bottom-tab-bar'
import { TechnicianShell } from '@/components/technician/technician-shell'
import { BRAND_THEME_COLOR } from '@/lib/brand-tokens'
import { ServiceWorkerRegister } from './sw-register'

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-lexend',
})

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
  themeColor: BRAND_THEME_COLOR,
}

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${lexend.variable} flex min-h-[max(884px,100dvh)] flex-col bg-background font-body dark:bg-background`}
    >
      <ServiceWorkerRegister />

      {/* Main content area — bottom bar auto-hides on /complete routes */}
      <main className="flex-1 overflow-y-auto pb-safe">
        <TechnicianShell>{children}</TechnicianShell>
      </main>

      <BottomTabBar />
    </div>
  )
}
