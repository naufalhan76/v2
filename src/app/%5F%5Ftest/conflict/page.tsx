'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConflictResolution } from '@/components/technician/conflict-resolution'
import { useConflicts } from '@/hooks/use-conflicts'
import { putConflict, deleteConflict, type ConflictRecord } from '@/lib/offline/db'

export default function ConflictTestPage() {
  const { conflicts, refresh, hasConflicts } = useConflicts()
  const [open, setOpen] = useState(false)

  // Seed mock data
  const seedConflicts = async () => {
    const mocks: ConflictRecord[] = [
      {
        id: window.crypto?.randomUUID() || Math.random().toString(36),
        orderId: 'ORD-TEST-1',
        kind: 'CANCELLED',
        createdAt: Date.now(),
        serverMessage: 'Pesanan telah dibatalkan oleh admin saat Anda offline.',
        transitionSnapshot: null,
        reportSnapshot: {
          idempotencyKey: window.crypto?.randomUUID() || Math.random().toString(36),
          orderId: 'ORD-TEST-1',
          technicianId: 'tech-1',
          photoIds: ['p1', 'p2'],
          payload: {
            idempotency_key: window.crypto?.randomUUID() || Math.random().toString(36),
            photos_before: ['url1'],
            photos_after: ['url2'],
            materials: [],
            actual_total_price: 350000,
            customer_signature_url: 'sig',
            customer_name_signed: 'Budi',
            notes: '',
            ac_units: [
              {
                ac_unit_id: 'ac1',
                photos_before: ['url3'],
                photos_after: ['url4'],
                materials_used: [],
                skipped: false,
                notes: ''
              },
              {
                ac_unit_id: 'ac2',
                photos_before: [],
                photos_after: [],
                materials_used: [],
                skipped: false,
                notes: ''
              }
            ]
          },
          attempts: 1,
          lastAttemptAt: Date.now(),
          lastError: null,
          createdAt: Date.now(),
        }
      },
      {
        id: window.crypto?.randomUUID() || Math.random().toString(36),
        orderId: 'ORD-TEST-2',
        kind: 'REASSIGNED',
        createdAt: Date.now() - 1000,
        serverMessage: 'Pesanan telah dialihkan ke teknisi lain.',
        transitionSnapshot: {
          idempotencyKey: window.crypto?.randomUUID() || Math.random().toString(36),
          orderId: 'ORD-TEST-2',
          payload: {
            to_status: 'IN_PROGRESS',
            idempotency_key: window.crypto?.randomUUID() || Math.random().toString(36),
            gps: null
          },
          attempts: 1,
          lastAttemptAt: Date.now(),
          lastError: null,
          createdAt: Date.now()
        },
        reportSnapshot: null
      },
      {
        id: window.crypto?.randomUUID() || Math.random().toString(36),
        orderId: 'ORD-TEST-3',
        kind: 'AUTH',
        createdAt: Date.now() - 2000,
        serverMessage: 'Sesi Anda telah berakhir, harap login kembali.',
        transitionSnapshot: null,
        reportSnapshot: {
          idempotencyKey: window.crypto?.randomUUID() || Math.random().toString(36),
          orderId: 'ORD-TEST-3',
          technicianId: 'tech-1',
          photoIds: ['p3'],
          payload: {
            idempotency_key: window.crypto?.randomUUID() || Math.random().toString(36),
            photos_before: ['url1'],
            photos_after: ['url2'],
            materials: [],
            actual_total_price: 150000,
            customer_signature_url: 'sig',
            customer_name_signed: 'Ani',
            notes: '',
            ac_units: []
          },
          attempts: 1,
          lastAttemptAt: Date.now(),
          lastError: null,
          createdAt: Date.now(),
        }
      }
    ]

    for (const mock of mocks) {
      await putConflict(mock)
    }
    await refresh()
    setOpen(true)
  }

  // Expose for Playwright
  if (typeof window !== 'undefined') {
    ;(window as any).__seedConflict = seedConflicts
  }

  const handleDiscard = async (id: string) => {
    await deleteConflict(id)
    await refresh()
  }

  const handleExport = (record: ConflictRecord) => {
    console.log('Exporting...', record)
    alert('Export triggered for ' + record.orderId)
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Conflict Resolution Test Harness</h1>
      
      <div className="flex gap-4">
        <Button onClick={seedConflicts} id="seed-btn">Seed Mocks</Button>
        <Button onClick={() => setOpen(true)} disabled={!hasConflicts} id="open-btn">
          Open Modal ({conflicts.length})
        </Button>
      </div>

      <ConflictResolution 
        open={open}
        onOpenChange={setOpen}
        conflicts={conflicts}
        onDiscard={handleDiscard}
        onExport={handleExport}
      />
    </div>
  )
}
