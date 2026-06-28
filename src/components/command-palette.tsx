'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  UserCheck,
  Wrench,
  Settings,
  LogOut,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { signOut } = useAuth()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange])

  function runCommand(cmd: () => void) {
    onOpenChange(false)
    cmd()
  }

  const commands = [
    {
      group: 'Navigasi',
      items: [
        {
          label: 'Dashboard',
          icon: LayoutDashboard,
          action: () => router.push('/dashboard'),
        },
        {
          label: 'Orders Board',
          icon: ClipboardList,
          action: () => router.push('/dashboard/orders?view=board'),
        },
        {
          label: 'Orders List',
          icon: ClipboardList,
          action: () => router.push('/dashboard/orders?view=list'),
        },
        {
          label: 'Technician Jobs',
          icon: Wrench,
          action: () => router.push('/dashboard/technician/jobs'),
        },
        {
          label: 'Settings',
          icon: Settings,
          action: () => router.push('/dashboard/settings'),
        },
      ],
    },
    {
      group: 'Aksi',
      items: [
        {
          label: 'Buat Order',
          icon: Plus,
          action: () => router.push('/dashboard/orders/new'),
        },
        {
          label: 'Tugaskan Order',
          icon: UserCheck,
          action: () => router.push('/dashboard/orders?view=board'),
        },
      ],
    },
    {
      group: 'Akun',
      items: [
        {
          label: 'Logout',
          icon: LogOut,
          action: async () => {
            await signOut()
            window.location.href = '/login'
          },
        },
      ],
    },
  ]

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Cari perintah..." />
      <CommandList>
        {commands.map((group, groupIndex) => (
          <CommandGroup key={group.group} heading={group.group}>
            {group.items.map((item) => (
              <CommandItem
                key={item.label}
                onSelect={() => runCommand(item.action)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
            {groupIndex < commands.length - 1 && <CommandSeparator />}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
