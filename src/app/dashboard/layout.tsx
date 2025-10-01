'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Navbar } from '@/components/navbar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen w-full overflow-hidden">
      {/* Mobile Layout */}
      <div className="md:hidden h-full flex flex-col">
        {/* Mobile Header with Hamburger */}
        <header className="flex-none flex h-14 items-center gap-4 border-b bg-background px-4">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 h-full">
              <Sidebar onCollapse={setIsSidebarCollapsed} />
            </SheetContent>
          </Sheet>
          <Navbar />
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] h-full">
        <aside className="h-full overflow-hidden">
          <Sidebar onCollapse={setIsSidebarCollapsed} />
        </aside>
        <div className="flex flex-col h-full overflow-hidden">
          <header className="flex-none">
            <Navbar />
          </header>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}