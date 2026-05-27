'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'

import { QueueTab } from './_components/queue-tab'
import { MonitoringTab } from './_components/monitoring-tab'

type TabValue = 'antrian' | 'monitoring'

const VALID_TABS: readonly TabValue[] = ['antrian', 'monitoring'] as const

function isValidTab(v: string | null): v is TabValue {
  return !!v && (VALID_TABS as readonly string[]).includes(v)
}

export default function RemindersPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get('tab')
  // Accept both `?tab=monitoring` and the canonical value
  const initialTab: TabValue = isValidTab(tabParam) ? tabParam : 'antrian'

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'antrian') {
        params.delete('tab')
      } else {
        params.set('tab', value)
      }
      const qs = params.toString()
      router.replace(qs ? `/dashboard/reminders?${qs}` : '/dashboard/reminders')
    },
    [router, searchParams]
  )

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/reminders/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json()) as {
        success: boolean
        data?: { generated_count: number; skipped_count: number }
        error?: string
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal generate reminder')
      }
      return json.data ?? { generated_count: 0, skipped_count: 0 }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-reminders'] })
      queryClient.invalidateQueries({ queryKey: ['serviced-ac-units'] })
      toast({
        title: 'Reminder digenerate',
        description: `${data.generated_count} reminder baru, ${data.skipped_count} dilewati.`,
      })
    },
    onError: (error: Error) => {
      logger.error('generateRemindersFromAcUnits failed:', error)
      toast({
        title: 'Gagal generate reminder',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header (shared across both tabs) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pengingat Service</h1>
          <p className="text-muted-foreground mt-1">
            Kelola pengingat service rutin untuk pelanggan berdasarkan jadwal AC.
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate Reminder
        </Button>
      </div>

      <Tabs
        value={initialTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="antrian">Antrian Reminder</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring AC</TabsTrigger>
        </TabsList>

        <TabsContent value="antrian" className="mt-0">
          <QueueTab
            onGenerate={() => generateMutation.mutate()}
            isGenerating={generateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-0">
          <MonitoringTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
