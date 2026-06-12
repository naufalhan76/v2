import type { Metadata, Viewport } from 'next'
import { Lexend } from 'next/font/google'
import { BottomTabBar } from '@/components/technician/bottom-tab-bar'
import { TechnicianShell } from '@/components/technician/technician-shell'
import { TechnicianThemeProvider, TechnicianThemeScript } from '@/hooks/use-technician-theme'
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
  themeColor: '#1e1b5e',
}

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TechnicianThemeProvider>
      <TechnicianThemeScript />
      <div
        className={`${lexend.variable} technician flex min-h-[max(884px,100dvh)] flex-col bg-bg-gray-faded font-body dark:bg-[#0f0e1a]`}
      >
        <ServiceWorkerRegister />

        {/* Main content area — bottom bar auto-hides on /complete routes */}
        <main className="flex-1 overflow-y-auto pb-safe">
          <TechnicianShell>{children}</TechnicianShell>
        </main>

        <BottomTabBar />
      </div>
    </TechnicianThemeProvider>
  )
}
