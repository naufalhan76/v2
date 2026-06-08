"use client"

import { type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  },
}

/**
 * Reusable empty state component for tables, lists, and board columns.
 * Displays an icon, title, optional description, and optional action button
 * with staggered fade-in animation.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center py-10 sm:py-12 px-4 text-center', className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas-soft mb-4"
        variants={itemVariants}
      >
        <Icon className="h-6 w-6 text-ink-faint" />
      </motion.div>
      <motion.h3
        className="text-[22px] font-[460] text-foreground mb-1"
        variants={itemVariants}
      >
        {title}
      </motion.h3>
      {description && (
        <motion.p
          className="text-lg text-ink-mute max-w-[280px] sm:max-w-sm mb-4"
          variants={itemVariants}
        >
          {description}
        </motion.p>
      )}
      {action && (
        <motion.div variants={itemVariants}>
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            className="mt-2 min-h-[44px] sm:min-h-0"
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
