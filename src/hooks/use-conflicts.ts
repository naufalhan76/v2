import { useState, useEffect, useCallback } from 'react'
import { getAllConflicts, type ConflictRecord } from '@/lib/offline/db'

export function useConflicts() {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])
  
  const refresh = useCallback(async () => {
    try {
      const all = await getAllConflicts()
      // sort by createdAt desc
      setConflicts(all.sort((a, b) => b.createdAt - a.createdAt))
    } catch (err) {
      console.error('Failed to load conflicts', err)
    }
  }, [])

  useEffect(() => {
    void refresh()

    const handleUpdate = () => void refresh()
    window.addEventListener('msn-conflict-update', handleUpdate)
    return () => window.removeEventListener('msn-conflict-update', handleUpdate)
  }, [refresh])

  return {
    conflicts,
    refresh,
    hasConflicts: conflicts.length > 0,
  }
}
