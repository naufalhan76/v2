import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig {
  key: string | null
  direction: SortDirection
}

export function useSortableTable<T>(data: T[], initialSort?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    initialSort || { key: null, direction: null }
  )

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key!)
      const bValue = getNestedValue(b, sortConfig.key!)

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Date comparison
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }

      // Try to parse as date strings
      const aDate = new Date(aValue)
      const bDate = new Date(bValue)
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortConfig.direction === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime()
      }

      // Fallback to string comparison
      return sortConfig.direction === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue))
    })

    return sorted
  }, [data, sortConfig])

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc'

    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'
      } else if (sortConfig.direction === 'desc') {
        direction = null
      }
    }

    setSortConfig({ key: direction ? key : null, direction })
  }

  return { sortedData, sortConfig, requestSort }
}

// Helper to get nested object values (e.g., "customers.customer_name")
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}
