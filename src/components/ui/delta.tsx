import * as React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DeltaProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  variant?: 'badge' | 'text'
}

function Delta({ value, variant = 'badge', className, children, ...props }: DeltaProps) {
  const isPositive = value > 0
  const isNegative = value < 0
  const isNeutral = value === 0

  const colorClass = isPositive
    ? 'text-emerald-600'
    : isNegative
      ? 'text-red-600'
      : 'text-zinc-500'

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : null

  const displayValue = `${isPositive ? '+' : ''}${value}%`

  if (variant === 'badge') {
    const bgClass = isPositive
      ? 'bg-emerald-50'
      : isNegative
        ? 'bg-red-50'
        : 'bg-zinc-50'

    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
          bgClass,
          colorClass,
          className
        )}
        {...props}
      >
        {Icon && <Icon className="h-3 w-3" />}
        <span>{displayValue}</span>
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1 text-sm font-semibold', colorClass, className)}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span>{displayValue}</span>
      {children}
    </div>
  )
}

export { Delta }
