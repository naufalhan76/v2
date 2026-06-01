import '@testing-library/jest-dom'

// Polyfill ResizeObserver for Recharts ResponsiveContainer in jsdom
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
