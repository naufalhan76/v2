import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sidebarItems, type SidebarItem } from './sidebar-items'

interface SidebarNavItemsProps {
  isCollapsed: boolean
  expandedItems: string[]
  pathname: string
  userRole: string | null
  onToggleExpanded: (href: string) => void
}

export function SidebarNavItems({
  isCollapsed,
  expandedItems,
  pathname,
  userRole,
  onToggleExpanded,
}: SidebarNavItemsProps) {
  return (
    <nav className="grid items-start px-2 py-2 text-sm lg:px-4">
      {sidebarItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          item={item}
          isCollapsed={isCollapsed}
          expandedItems={expandedItems}
          pathname={pathname}
          userRole={userRole}
          onToggleExpanded={onToggleExpanded}
        />
      ))}
    </nav>
  )
}

function SidebarNavItem({
  item,
  isCollapsed,
  expandedItems,
  pathname,
  userRole,
  onToggleExpanded,
}: SidebarNavItemsProps & { item: SidebarItem }) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedItems.includes(item.href)
  const filteredChildren = hasChildren ? filterMenuItems(item.children || [], userRole) : []
  const hasVisibleChildren = filteredChildren.length > 0
  if (hasChildren && !hasVisibleChildren) return null

  const isActive = pathname === item.href || (hasChildren && filteredChildren.some((child) => pathname === child.href))

  return (
    <div className="space-y-1">
      {hasVisibleChildren ? (
        <button
          onClick={() => onToggleExpanded(item.href)}
          className={cn(
            'flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-all duration-150 hover:bg-surface-muted hover:text-foreground',
            isActive && 'bg-primary/10 text-primary border-l-2 border-primary'
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon className="h-4 w-4" />
            {!isCollapsed && <span>{item.title}</span>}
          </div>
          {!isCollapsed && <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-90')} />}
        </button>
      ) : (
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-all duration-150 hover:bg-surface-muted hover:text-foreground',
            pathname === item.href && 'bg-primary/10 text-primary border-l-2 border-primary'
          )}
        >
          <item.icon className="h-4 w-4" />
          {!isCollapsed && <span>{item.title}</span>}
        </Link>
      )}

      {hasVisibleChildren && !isCollapsed && (
        <div className={cn('ml-6 space-y-1 overflow-hidden transition-all duration-200', isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0')}>
          {filteredChildren.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all duration-150 hover:bg-surface-muted hover:text-foreground',
                pathname === child.href && 'bg-primary/10 text-primary font-medium'
              )}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function filterMenuItems<T extends { href: string; title: string; requireRole?: string; children?: T[] }>(items: T[], userRole: string | null): T[] {
  return items.flatMap((item) => {
    if (item.requireRole && userRole !== item.requireRole) return []
    if (item.children && item.children.length > 0) {
      return [{ ...item, children: filterMenuItems(item.children, userRole) }]
    }
    return [item]
  })
}
