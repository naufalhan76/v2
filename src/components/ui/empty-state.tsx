import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Lucide icon component to display */
  icon: LucideIcon
  /** Main title text */
  title: string
  /** Optional description text */
  description?: string
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  /** Optional additional className */
  className?: string
}

/**
 * Reusable empty state component for tables, lists, and board columns.
 * Displays an icon, title, optional description, and optional action button.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 sm:py-12 px-4 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas-soft mb-4">
        <Icon className="h-6 w-6 text-ink-faint" />
      </div>
      <h3 className="text-[22px] font-[460] text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-lg text-ink-mute max-w-[280px] sm:max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-2 min-h-[44px] sm:min-h-0"
        >
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  )
}
