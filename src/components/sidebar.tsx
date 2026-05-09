'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import {
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
  User,
  ChevronRight,
  ChevronLeft,
  Moon,
  Sun,
  DollarSign,
  Code
} from 'lucide-react'

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Operasional',
    href: '/dashboard/operasional',
    icon: ClipboardList,
    children: [
      { title: 'Create Order', href: '/dashboard/operasional/create-order' },
      { title: 'Assign Order', href: '/dashboard/operasional/assign-order' },
      { title: 'Monitoring Ongoing', href: '/dashboard/operasional/monitoring-ongoing' },
      { title: 'Monitoring History', href: '/dashboard/operasional/monitoring-history' },
    ],
  },
  {
    title: 'Konfigurasi',
    href: '/dashboard/konfigurasi',
    icon: Settings,
    children: [
      { title: 'Invoice Config', href: '/dashboard/konfigurasi/invoice-config' },
      { title: 'Konfigurasi Service', href: '/dashboard/konfigurasi/service-config' },
      { title: 'SLA Service', href: '/dashboard/konfigurasi/sla-service' },
    ],
  },
  {
    title: 'Manajemen',
    href: '/dashboard/manajemen',
    icon: Users,
    children: [
      { title: 'User', href: '/dashboard/manajemen/user', requireRole: 'SUPERADMIN' },
      { title: 'Customer', href: '/dashboard/manajemen/customer' },
      { title: 'AC Units', href: '/dashboard/manajemen/ac-units' },
      { title: 'Teknisi', href: '/dashboard/manajemen/teknisi' },
      { title: 'Lokasi Pelanggan', href: '/dashboard/manajemen/lokasi' },
    ],
  },
  {
    title: 'Keuangan',
    href: '/dashboard/keuangan',
    icon: DollarSign,
    children: [
      { title: 'Invoices', href: '/dashboard/keuangan/invoices' },
    ],
  },
  {
    title: 'Admin',
    href: '/dashboard/admin',
    icon: Code,
    requireRole: 'SUPERADMIN',
    children: [
      { title: 'API Documentation', href: '/dashboard/admin/api-docs', requireRole: 'SUPERADMIN' },
    ],
  },
]

export function Sidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const fetchUserRole = async () => {
      const { createClient } = await import('@/lib/supabase-browser')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: userData } = await supabase
          .from('user_management')
          .select('role')
          .eq('auth_user_id', session.user.id)
          .single()
        setUserRole(userData?.role || null)
      }
    }
    fetchUserRole()
  }, [])

  const filterMenuItems = (items: { href: string; title: string; requireRole?: string; children?: { href: string; title: string; requireRole?: string }[] }[]) => {
    return items.filter(item => {
      if (item.requireRole && userRole !== item.requireRole) return false
      return true
    }).map(item => {
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: item.children.filter((child: { href: string; title: string; requireRole?: string }) => {
            if (child.requireRole && userRole !== child.requireRole) return false
            return true
          })
        }
      }
      return item
    })
  }

  const handleToggle = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    if (onCollapse) onCollapse(newState)
  }

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href)
        ? prev.filter(item => item !== href)
        : [...prev, href]
    )
  }

  return (
    <div className={`border-r bg-card ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 h-full flex flex-col`}>
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4 lg:h-[60px] lg:px-6 shrink-0 relative">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center justify-center flex-1">
            <Image src="/logo.png" alt="MSN ERP" className="h-10 w-auto" width={120} height={40} />
          </Link>
        )}
        <button
          onClick={handleToggle}
          className={`p-1 rounded-md hover:bg-muted transition-colors duration-150 ${isCollapsed ? 'mx-auto' : ''}`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-2 py-2 text-sm font-medium lg:px-4">
          {sidebarItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.includes(item.href)
            const filteredChildren = hasChildren ? filterMenuItems(item.children || []) : []
            const hasVisibleChildren = filteredChildren.length > 0

            if (hasChildren && !hasVisibleChildren) return null

            const isActive = pathname === item.href || (hasChildren && filteredChildren?.some(child => pathname === child.href))

            return (
              <div key={item.href} className="space-y-1">
                {hasVisibleChildren ? (
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={cn(
                      'flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground',
                      isActive && 'bg-primary/10 text-primary border-l-2 border-primary'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </div>
                    {!isCollapsed && (
                      <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-90')} />
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground',
                      pathname === item.href && 'bg-primary/10 text-primary border-l-2 border-primary'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                )}

                {hasVisibleChildren && !isCollapsed && (
                  <div className={cn(
                    'ml-6 space-y-1 overflow-hidden transition-all duration-200',
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  )}>
                    {filteredChildren.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground',
                          pathname === child.href && 'bg-primary/10 text-primary font-medium'
                        )}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/40"></div>
                        {child.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-border/50">
        {!isCollapsed ? (
          <ProfileSection />
        ) : (
          <div className="p-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors duration-150"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <Switch disabled />

  return (
    <Switch
      checked={theme === 'dark'}
      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
    />
  )
}

function ProfileSection() {
  const [user, setUser] = useState<{
    email: string
    full_name: string
    role: string
    avatar_url?: string
  } | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const { createClient } = await import('@/lib/supabase-browser')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: userData } = await supabase
          .from('user_management')
          .select('full_name, email, role, photo_url')
          .eq('auth_user_id', session.user.id)
          .single()
        setUser({
          email: session.user.email,
          full_name: userData?.full_name || session.user.email,
          role: userData?.role || 'USER',
          avatar_url: userData?.photo_url || session.user.user_metadata?.avatar_url
        })
      }
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase-browser')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!user) return null

  return (
    <div className="bg-card p-4 space-y-3 border-t border-border/50">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="text-sm font-medium">Dark Mode</span>
        </div>
        <DarkModeToggle />
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 w-full rounded-lg p-2 hover:bg-muted transition-colors duration-150"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt="Profile" className="w-8 h-8 rounded-full object-cover" width={32} height={32} />
            ) : (
              user.full_name?.charAt(0)?.toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium truncate">{user.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border/50 rounded-xl shadow-lg py-2">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-4 w-4" />
              Profile Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-destructive hover:text-destructive"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
