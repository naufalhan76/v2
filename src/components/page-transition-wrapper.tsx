'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()

  // Always render the same DOM structure to avoid hydration mismatch.
  // When reduced motion is preferred, pass `false` to skip all animations.
  // Framer Motion treats `false` as "no animation" on initial/animate/exit.
  const initial = prefersReducedMotion ? false : { opacity: 0 }
  const animate = prefersReducedMotion ? false : { opacity: 1 }
  const exit = prefersReducedMotion ? undefined : { opacity: 0 }
  const transition = prefersReducedMotion
    ? undefined
    : ({ duration: 0.2, ease: 'easeInOut' } as const)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className={className}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
