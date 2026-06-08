'use client'

import { PageTransition } from '@/components/page-transition-wrapper'

export function AnimationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageTransition>{children}</PageTransition>
}
