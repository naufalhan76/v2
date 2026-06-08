'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Navbar } from '@/components/navbar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { CommandPalette } from '@/components/command-palette'

export function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  return (
    <div className="h-dvh w-full overflow-hidden" data-testid="dashboard-shell">
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Mobile Layout */}
      <div className="md:hidden h-full min-h-0 flex flex-col">
        {/* Mobile Header with Hamburger */}
        <header className="flex-none flex h-14 items-center gap-4 border-b border-hairline bg-background px-4">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden min-h-[44px] min-w-[44px]">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 h-full">
              <Sidebar onCollapse={setIsSidebarCollapsed} />
            </SheetContent>
          </Sheet>
          <Navbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas-soft p-xl">
          {children}
        </main>
      </div>

      {/* Desktop Layout */}
      <div
        className="hidden md:grid h-full min-h-0 transition-[grid-template-columns] duration-300"
        style={{ gridTemplateColumns: `${isSidebarCollapsed ? '4rem' : '16rem'} 1fr` }}
      >
        <aside className="h-full min-h-0 overflow-hidden">
          <Sidebar onCollapse={setIsSidebarCollapsed} />
        </aside>
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="flex-none">
            <Navbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas-soft p-xl lg:p-huge">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
