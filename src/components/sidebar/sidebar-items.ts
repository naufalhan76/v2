import {
  Bell,
  BookOpen,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface SidebarItem {
  title: string
  href: string
  icon: LucideIcon
  requireRole?: string
  children?: Array<{ title: string; href: string; requireRole?: string }>
}

export const sidebarItems: SidebarItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Orders', href: '/dashboard/orders', icon: ClipboardList },
  { title: 'History', href: '/dashboard/orders/history', icon: History },
  { title: 'Invoices', href: '/dashboard/keuangan/invoices', icon: FileText },
  { title: 'Customers', href: '/dashboard/manajemen/customer', icon: Users },
  { title: 'Technicians', href: '/dashboard/manajemen/teknisi', icon: Wrench },
  { title: 'Reminders', href: '/dashboard/reminders', icon: Bell },
  { title: 'Panduan', href: '/dashboard/docs', icon: BookOpen },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    children: [
      { title: 'Service Config', href: '/dashboard/konfigurasi/service-config' },
      { title: 'Addons', href: '/dashboard/konfigurasi/addons-catalog' },
      { title: 'Reminder Rules', href: '/dashboard/settings/reminder-rules' },
      { title: 'Invoice Settings', href: '/dashboard/konfigurasi/invoice-config' },
      { title: 'Users', href: '/dashboard/manajemen/user', requireRole: 'SUPERADMIN' },
    ],
  },
]
