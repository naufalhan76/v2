'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Loader2, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PhotoUpload } from './photo-upload'
import { MaterialInput, type MaterialItem } from './material-input'
import { SignaturePad } from './signature-pad'
import { createClient } from '@/lib/supabase-browser'

interface CompleteJobFormProps {
  orderId: string
}

interface DraftData {
  photos_before: string[]
  photos_after: string[]
  materials: MaterialItem[]
  actual_total_price: number
  notes: string
  customer_signature: string | null
  customer_name_signed: string
  work_started_at: string | null
  next_service_date: string
  next_service_notes: string
}

const DRAFT_KEY_PREFIX = 'draft-'

/** Default next-service date: today + 90 days, formatted YYYY-MM-DD. */
function getDefaultNextServiceDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 90)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getDraftKey(orderId: string) {
  return `${DRAFT_KEY_PREFIX}${orderId}`
}

function saveDraft(orderId: string, data: DraftData) {
  try {
    localStorage.setItem(getDraftKey(orderId), JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

function loadDraft(orderId: string): DraftData | null {
  try {
    const raw = localStorage.getItem(getDraftKey(orderId))
    if (!raw) return null
    return JSON.parse(raw) as DraftData
  } catch {
    return null
  }
}

function clearDraft(orderId: string) {
  try {
    localStorage.removeItem(getDraftKey(orderId))
  } catch {
    // ignore
  }
}

export function CompleteJobForm({ orderId }: CompleteJobFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Form state
  const [photosBefore, setPhotosBefore] = useState<string[]>([])
  const [photosAfter, setPhotosAfter] = useState<string[]>([])
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [actualPrice, setActualPrice] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [customerSignature, setCustomerSignature] = useState<string | null>(null)
  const [customerNameSigned, setCustomerNameSigned] = useState('')
  const [workStartedAt] = useState<string | null>(new Date().toISOString())
  const [nextServiceDate, setNextServiceDate] = useState<string>(getDefaultNextServiceDate())
  const [nextServiceNotes, setNextServiceNotes] = useState('')

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [draftRestored, setDraftRestored] = useState(false)

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft(orderId)
    if (draft) {
      setPhotosBefore(draft.photos_before)
      setPhotosAfter(draft.photos_after)
      setMaterials(draft.materials)
      setActualPrice(draft.actual_total_price)
      setNotes(draft.notes)
      setCustomerSignature(draft.customer_signature)
      setCustomerNameSigned(draft.customer_name_signed)
      if (draft.next_service_date) setNextServiceDate(draft.next_service_date)
      if (draft.next_service_notes) setNextServiceNotes(draft.next_service_notes)
      setDraftRestored(true)
    }
  }, [orderId])

  // Auto-save draft (debounced 500ms)
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      const draftData: DraftData = {
        photos_before: photosBefore,
        photos_after: photosAfter,
        materials,
        actual_total_price: actualPrice,
        notes,
        customer_signature: customerSignature,
        customer_name_signed: customerNameSigned,
        work_started_at: workStartedAt,
        next_service_date: nextServiceDate,
        next_service_notes: nextServiceNotes,
      }
      saveDraft(orderId, draftData)
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [photosBefore, photosAfter, materials, actualPrice, notes, customerSignature, customerNameSigned, orderId, workStartedAt, nextServiceDate, nextServiceNotes])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Recalculate actual price when materials change
  useEffect(() => {
    const materialsTotal = materials.reduce((sum, m) => sum + m.total, 0)
    // Only auto-update if user hasn't manually edited (or if it's still 0)
    if (actualPrice === 0 || !draftRestored) {
      setActualPrice(materialsTotal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials])

  const handleSubmit = useCallback(async () => {
    setSubmitError(null)

    // Validation
    if (photosBefore.length < 1) {
      setSubmitError('Minimal 1 foto sebelum pengerjaan')
      return
    }
    if (photosAfter.length < 1) {
      setSubmitError('Minimal 1 foto sesudah pengerjaan')
      return
    }
    if (!customerSignature) {
      setSubmitError('Tanda tangan customer wajib diisi')
      return
    }
    if (!customerNameSigned.trim()) {
      setSubmitError('Nama penandatangan wajib diisi')
      return
    }
    if (actualPrice <= 0) {
      setSubmitError('Harga aktual wajib diisi')
      return
    }

    setSubmitting(true)

    try {
      // 1. Upload signature to Supabase Storage
      const supabase = createClient()
      const signatureBlob = await fetch(customerSignature).then((r) => r.blob())
      const signatureFilename = `orders/${orderId}/signature-${Date.now()}.png`

      const { data: sigData, error: sigError } = await supabase.storage
        .from('signatures')
        .upload(signatureFilename, signatureBlob, {
          contentType: 'image/png',
          upsert: false,
        })

      if (sigError) {
        throw new Error(`Upload signature gagal: ${sigError.message}`)
      }

      // Get signed URL for the signature (private bucket)
      const { data: signedUrlData } = await supabase.storage
        .from('signatures')
        .createSignedUrl(sigData.path, 60 * 60 * 24 * 365) // 1 year

      const signatureUrl = signedUrlData?.signedUrl || ''

      // 2. Submit report via API
      const res = await fetch(`/api/technician/jobs/${orderId}/report`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos_before: photosBefore,
          photos_after: photosAfter,
          materials: materials.filter((m) => m.name.trim() !== ''),
          actual_total_price: actualPrice,
          customer_signature_url: signatureUrl,
          customer_name_signed: customerNameSigned.trim(),
          notes: notes.trim(),
          work_started_at: workStartedAt,
          work_completed_at: new Date().toISOString(),
          next_service_recommendation_date: nextServiceDate || null,
          next_service_recommendation_notes: nextServiceNotes.trim() || null,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal mengirim laporan')
      }

      // 3. Success — clear draft and redirect
      clearDraft(orderId)
      queryClient.invalidateQueries({ queryKey: ['technician'] })
      router.push('/technician')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }, [
    photosBefore,
    photosAfter,
    materials,
    actualPrice,
    customerSignature,
    customerNameSigned,
    notes,
    workStartedAt,
    nextServiceDate,
    nextServiceNotes,
    orderId,
    queryClient,
    router,
  ])

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href={`/technician/job/${orderId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground h-11 px-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali</span>
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Laporan Pekerjaan</h1>
        <p className="text-sm text-muted-foreground">
          Lengkapi laporan untuk menyelesaikan pekerjaan ini
        </p>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Anda sedang offline. Data tersimpan sebagai draft.</span>
        </div>
      )}

      {/* Draft restored notice */}
      {draftRestored && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          Draft sebelumnya berhasil dipulihkan.
        </div>
      )}

      {/* Photos Before */}
      <PhotoUpload
        label="Foto Sebelum"
        bucket="service-photos"
        pathPrefix={`orders/${orderId}/before`}
        value={photosBefore}
        onChange={setPhotosBefore}
        min={1}
        max={5}
        disabled={submitting}
      />

      {/* Photos After */}
      <PhotoUpload
        label="Foto Sesudah"
        bucket="service-photos"
        pathPrefix={`orders/${orderId}/after`}
        value={photosAfter}
        onChange={setPhotosAfter}
        min={1}
        max={5}
        disabled={submitting}
      />

      {/* Materials */}
      <MaterialInput
        value={materials}
        onChange={setMaterials}
        disabled={submitting}
      />

      {/* Actual Price */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="actual-price">
          Harga Aktual (Rp)
        </label>
        <Input
          id="actual-price"
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={actualPrice}
          onChange={(e) => setActualPrice(Math.max(0, Number(e.target.value) || 0))}
          disabled={submitting}
          className="h-11 text-base"
          placeholder="0"
        />
        <p className="text-xs text-muted-foreground">
          Pre-filled dari total material. Bisa disesuaikan jika ada negosiasi di lapangan.
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="notes">
          Catatan (opsional)
        </label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={submitting}
          placeholder="Catatan tambahan tentang pekerjaan..."
          className="min-h-[80px] text-base"
        />
      </div>

      {/* Next-service recommendation */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <div>
          <h2 className="text-sm font-semibold">Rekomendasi Service Berikutnya</h2>
          <p className="text-xs text-muted-foreground">
            Estimasi jadwal service rutin selanjutnya. Default 90 hari, sesuaikan jika perlu.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="next-service-date">
            Tanggal Service Rutin Berikutnya
          </label>
          <Input
            id="next-service-date"
            type="date"
            value={nextServiceDate}
            onChange={(e) => setNextServiceDate(e.target.value)}
            disabled={submitting}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="next-service-notes">
            Catatan untuk service berikutnya
          </label>
          <Textarea
            id="next-service-notes"
            value={nextServiceNotes}
            onChange={(e) => setNextServiceNotes(e.target.value)}
            disabled={submitting}
            placeholder="Mis. perlu cek freon, ganti filter, dll..."
            className="min-h-[80px] text-base"
          />
        </div>
      </div>

      {/* Customer Signature */}
      <SignaturePad
        value={customerSignature}
        onChange={setCustomerSignature}
        disabled={submitting}
      />

      {/* Customer Name Signed */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="customer-name">
          Nama Penandatangan
        </label>
        <Input
          id="customer-name"
          type="text"
          value={customerNameSigned}
          onChange={(e) => setCustomerNameSigned(e.target.value)}
          disabled={submitting}
          placeholder="Nama lengkap customer"
          className="h-11 text-base"
        />
      </div>

      {/* Error message */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={submitting || !isOnline}
        className="w-full h-12 text-base font-medium"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Mengirim Laporan...
          </>
        ) : (
          <>
            <Send className="mr-2 h-5 w-5" />
            Kirim Laporan
          </>
        )}
      </Button>
    </div>
  )
}
