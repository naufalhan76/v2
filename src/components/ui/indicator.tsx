import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: 'emerald' | 'amber' | 'red' | 'blue'
  pulse?: boolean
}

function StatusIndicator({ color = 'emerald', pulse = false, className, ...props }: StatusIndicatorProps) {
  const colorMap = {
    emerald: 'bg-status-completed',
    amber: 'bg-status-pending',
    red: 'bg-status-cancelled',
    blue: 'bg-status-assigned',
  }

  const pulseClass = pulse ? 'animate-pulse' : ''

  return (
    <div
      className={cn('h-2 w-2 rounded-full', colorMap[color], pulseClass, className)}
      {...props}
    />
  )
}

export { StatusIndicator }
