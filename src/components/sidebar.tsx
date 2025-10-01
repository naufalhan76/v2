'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
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
  ChevronLeft
} from 'lucide-react'

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Konfigurasi',
    href: '/konfigurasi',
    icon: Settings,
    children: [
      {
        title: 'Harga Service',
        href: '/konfigurasi/harga-service',
      },
      {
        title: 'SLA Service',
        href: '/konfigurasi/sla-service',
      },
    ],
  },
  {
    title: 'Manajemen',
    href: '/manajemen',
    icon: Users,
    children: [
      {
        title: 'User',
        href: '/manajemen/user',
      },
      {
        title: 'AC Units',
        href: '/manajemen/ac-units',
      },
      {
        title: 'Teknisi',
        href: '/manajemen/teknisi',
      },
      {
        title: 'Lokasi Pelanggan',
        href: '/manajemen/lokasi',
      },
    ],
  },
  {
    title: 'Operasional',
    href: '/operasional',
    icon: ClipboardList,
    children: [
      {
        title: 'Assign Order',
        href: '/operasional/assign-order',
      },
      {
        title: 'Monitoring Ongoing',
        href: '/operasional/monitoring-ongoing',
      },
      {
        title: 'Monitoring History',
        href: '/operasional/monitoring-history',
      },
      {
        title: 'Accept Order',
        href: '/operasional/accept-order',
      },
    ],
  },
]

export function Sidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const pathname = usePathname()

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
    <div className={`hidden border-r bg-muted/40 md:block ${isCollapsed ? 'md:w-16' : 'md:w-64'} transition-all duration-300`}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center justify-between border-b px-4 lg:h-[60px] lg:px-6">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <AirVent className="h-6 w-6 text-blue-600" />
              <span>TechService ERP</span>
            </Link>
          )}
          <button
            onClick={handleToggle}
            className="p-1 rounded-md hover:bg-muted"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {sidebarItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0
              const isExpanded = expandedItems.includes(item.href)
              const isActive = pathname === item.href || (hasChildren && item.children?.some(child => pathname === child.href))
              
              return (
                <div key={item.href} className="space-y-1">
                  {hasChildren ? (
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
                  {hasChildren && !isCollapsed && (
                    <div 
                      className={cn(
                        "ml-6 space-y-1 overflow-hidden transition-all duration-200",
                        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      {item.children?.map((child) => (
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
        {!isCollapsed && <ProfileSection />}
      </div>
    </div>
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
          .select('full_name, email, role')
          .eq('auth_user_id', session.user.id)
          .single()
          
        setUser({
          email: session.user.email,
          full_name: userData?.full_name || session.user.email,
          role: userData?.role || 'USER',
          avatar_url: session.user.user_metadata?.avatar_url
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
    <div className="border-t bg-muted/40 p-4">
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
              href="/profile"
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