'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { AddonRequest } from '@/lib/actions/addon-requests'
import { AddonRequestTable } from './addon-request-table'
import { ApproveRequestDialog } from './approve-request-dialog'

interface AddonRequestCardProps {
  requests: AddonRequest[]
  isLoadingRequests: boolean
  pendingCount: number
  onApprove: (requestId: string, itemCode: string | null, finalPrice: number) => Promise<{ success: boolean; error?: string }>
  onReject: (requestId: string, notes?: string) => Promise<{ success: boolean; error?: string }>
  onRequestsLoaded: () => void
}

export function AddonRequestCard({
  requests,
  isLoadingRequests,
  pendingCount,
  onApprove,
  onReject,
  onRequestsLoaded,
}: AddonRequestCardProps) {
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [approvingRequest, setApprovingRequest] = useState<AddonRequest | null>(null)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectingRequest, setRejectingRequest] = useState<AddonRequest | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const handleOpenApprove = (request: AddonRequest) => {
    setApprovingRequest(request)
    setIsApproveOpen(true)
  }

  const handleApprove = async (itemCode: string | null, finalPrice: number) => {
    if (!approvingRequest) return { success: false }
    setIsApproving(true)
    try {
      return await onApprove(approvingRequest.request_id, itemCode, finalPrice)
    } finally {
      setIsApproving(false)
    }
  }

  const handleOpenReject = (request: AddonRequest) => {
    setRejectingRequest(request)
    setRejectNotes('')
    setIsRejectOpen(true)
  }

  const handleReject = async () => {
    if (!rejectingRequest) return
    setIsRejecting(true)
    try {
      const result = await onReject(rejectingRequest.request_id, rejectNotes || undefined)
      if (result.success) {
        setIsRejectOpen(false)
        setRejectingRequest(null)
        onRequestsLoaded()
      }
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <Card className="rounded-xl border border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Permintaan Part dari Teknisi</CardTitle>
            <CardDescription>{pendingCount} permintaan menunggu persetujuan</CardDescription>
          </div>
          {pendingCount > 0 && <Badge variant="secondary" className="text-sm">{pendingCount}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingRequests ? (
          <TableSkeleton rows={3} columns={7} />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada permintaan part menunggu persetujuan.</p>
        ) : (
          <AddonRequestTable requests={requests} onOpenApprove={handleOpenApprove} onOpenReject={handleOpenReject} />
        )}
      </CardContent>

      <ApproveRequestDialog
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        request={approvingRequest}
        isApproving={isApproving}
        onApprove={handleApprove}
        onApproved={onRequestsLoaded}
      />

      <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tolak Permintaan Part</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectingRequest && <span>Tolak permintaan <strong>{rejectingRequest.item_name}</strong>? </span>}
              Anda dapat memberikan alasan penolakan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectNotes" className="text-sm font-medium text-foreground">Alasan Penolakan (opsional)</Label>
            <Textarea id="rejectNotes" placeholder="Alasan penolakan..." rows={3} value={rejectNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectNotes(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRejecting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={isRejecting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isRejecting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menolak...</>) : 'Tolak'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
