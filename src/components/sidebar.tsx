'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useUser } from '@clerk/nextjs'
import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { SidebarNavItems } from './sidebar/nav-items'
import { ProfileSection } from './sidebar/sidebar-profile'
import { getMyUserProfile } from '@/lib/actions/my-profile'

export function Sidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const { user } = useUser()
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!user) return
    getMyUserProfile()
      .then((data) => {
        if (data) setUserRole(data.role)
      })
      .catch(() => {})
  }, [user])

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
    <motion.div
      className="border-r border-border bg-background h-full flex flex-col"
      animate={{ width: isCollapsed ? 64 : 256 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4 lg:h-[60px] lg:px-6 shrink-0 relative">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center justify-center flex-1">
            <Image src="/logo-msn.svg?v=20260610-newlogo" alt="MSN ERP" className="h-10 w-auto" width={160} height={40} priority />
          </Link>
        )}
        <button
          onClick={handleToggle}
          className={`p-1 rounded-md text-muted-foreground hover:bg-surface-muted transition-colors duration-150 ${isCollapsed ? 'mx-auto' : ''}`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNavItems
          isCollapsed={isCollapsed}
          expandedItems={expandedItems}
          pathname={pathname}
          userRole={userRole}
          onToggleExpanded={toggleExpanded}
        />
      </div>

      <div className="shrink-0 border-t border-border">
        {!isCollapsed ? (
          <ProfileSection />
        ) : (
          <div className="p-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-surface-muted transition-colors duration-150"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
