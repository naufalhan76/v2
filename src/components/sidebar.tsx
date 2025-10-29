'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import {
  LayoutDashboard,
  Settings,
  Users,
  AirVent,
  Wrench,
  MapPin,
  ClipboardList,
  Monitor,
  History,
  CheckCircle,
  User,
  ChevronRight,
  ChevronLeft,
  Moon,
  Sun,
  DollarSign,
  FileText,
  Package
} from 'lucide-react'

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Konfigurasi',
    href: '/dashboard/konfigurasi',
    icon: Settings,
    children: [
      {
        title: 'Invoice Config',
        href: '/dashboard/konfigurasi/invoice-config',
      },
      {
        title: 'Service Pricing',
        href: '/dashboard/konfigurasi/service-pricing',
      },
      {
        title: 'Addons Catalog',
        href: '/dashboard/konfigurasi/addons-catalog',
      },
      {
        title: 'SLA Service',
        href: '/dashboard/konfigurasi/sla-service',
      },
    ],
  },
  {
    title: 'Manajemen',
    href: '/dashboard/manajemen',
    icon: Users,
    children: [
      {
        title: 'User',
        href: '/dashboard/manajemen/user',
        requireRole: 'SUPERADMIN', // Only show for SUPERADMIN
      },
      {
        title: 'Customer',
        href: '/dashboard/manajemen/customer',
      },
      {
        title: 'AC Units',
        href: '/dashboard/manajemen/ac-units',
      },
      {
        title: 'Teknisi',
        href: '/dashboard/manajemen/teknisi',
      },
      {
        title: 'Lokasi Pelanggan',
        href: '/dashboard/manajemen/lokasi',
      },
    ],
  },
  {
    title: 'Operasional',
    href: '/dashboard/operasional',
    icon: ClipboardList,
    children: [
      {
        title: 'Assign Order',
        href: '/dashboard/operasional/assign-order',
      },
      {
        title: 'Accept Order',
        href: '/dashboard/operasional/accept-order',
      },
      {
        title: 'Monitoring Ongoing',
        href: '/dashboard/operasional/monitoring-ongoing',
      },
      {
        title: 'Monitoring History',
        href: '/dashboard/operasional/monitoring-history',
      },
    ],
  },
  {
    title: 'Keuangan',
    href: '/dashboard/keuangan',
    icon: DollarSign,
    children: [
      {
        title: 'Invoices',
        href: '/dashboard/keuangan/invoices',
      },
    ],
  },
]

export function Sidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const pathname = usePathname()

  // Fetch user role
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

  // Filter menu items based on user role
  const filterMenuItems = (items: any[]) => {
    return items.filter(item => {
      // If item has requireRole, check if user has that role
      if (item.requireRole && userRole !== item.requireRole) {
        return false
      }
      return true
    })
  }

  const handleToggle = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    if (onCollapse) {
      onCollapse(newState)
    }
  }

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter(item => item !== href)
        : [...prev, href]
    )
  }

  return (
    <div className={`border-r bg-muted/40 ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 h-full flex flex-col`}>
      <div className="flex h-14 items-center justify-between border-b px-4 lg:h-[60px] lg:px-6 shrink-0 relative">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center justify-center flex-1">
            <img 
              src="/logo.png" 
              alt="MSN ERP" 
              className="h-10 w-auto"
            />
          </Link>
        )}
        <button
          onClick={handleToggle}
          className={`p-1 rounded-md hover:bg-muted ${isCollapsed ? 'mx-auto' : ''}`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-2 py-2 text-sm font-medium lg:px-4">
            {sidebarItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0
              const isExpanded = expandedItems.includes(item.href)
              
              // Filter children based on role
              const filteredChildren = hasChildren ? filterMenuItems(item.children || []) : []
              const hasVisibleChildren = filteredChildren.length > 0
              
              // If parent has no visible children, hide parent too
              if (hasChildren && !hasVisibleChildren) {
                return null
              }
              
              const isActive = pathname === item.href || (hasChildren && filteredChildren?.some(child => pathname === child.href))
              
              return (
                <div key={item.href} className="space-y-1">
                  {hasVisibleChildren ? (
                    <button
                      onClick={() => toggleExpanded(item.href)}
                      className={cn(
                        'flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                        isActive && 'bg-muted text-primary'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </div>
                      {!isCollapsed && (
                        <ChevronRight 
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )} 
                        />
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                        pathname === item.href && 'bg-muted text-primary'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  )}
                  
                  {/* Submenu - expandable */}
                  {hasVisibleChildren && !isCollapsed && (
                    <div 
                      className={cn(
                        "ml-6 space-y-1 overflow-hidden transition-all duration-200",
                        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      {filteredChildren.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all hover:text-primary hover:bg-muted/50',
                            pathname === child.href && 'bg-muted text-primary font-medium'
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground"></div>
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
        
        {/* Profile Section - Footer */}
        <div className="shrink-0 border-t">
          {!isCollapsed ? (
            <ProfileSection />
          ) : (
            <div className="p-2">
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <User className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Dark Mode Toggle Component
function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Switch disabled />
  }

  return (
    <Switch
      checked={theme === 'dark'}
      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
    />
  )
}
function ProfileSection() {
  const [user, setUser] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      // Get user from Supabase session
      const { createClient } = await import('@/lib/supabase-browser')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Get user details from user_management table
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
    <div className="bg-muted/40 p-4 space-y-3">
      {/* Dark Mode Toggle */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="text-sm font-medium">Dark Mode</span>
        </div>
        <DarkModeToggle />
      </div>

      {/* User Profile */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 w-full rounded-lg p-2 hover:bg-muted transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              user.full_name?.charAt(0)?.toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium truncate">{user.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-90"
          )} />
        </button>
        
        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-lg py-2">
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
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left text-red-600 hover:text-red-700"
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