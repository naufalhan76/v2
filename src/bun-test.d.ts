declare module 'bun:test' {
  export { beforeEach, describe, expect, it } from 'vitest'
  export const mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void
  }
}
