'use client'

import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { SelectedAcLine } from '../_hooks/use-create-order-form'

const idrFmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

type Props = {
  line: SelectedAcLine
  idx: number
  groupLength: number
  lineCatalogMissing: boolean
  getAvailableServiceTypes: (u: string, c: string) => Array<{ id: string; label: string }>
  onPickService: (lineId: string, stId: string) => void
  onUpdateServiceLine: (lineId: string, patch: Partial<SelectedAcLine>) => void
  onDeleteServiceLine: (lineId: string) => void
}

export function ServiceItemRow({ line, idx, groupLength, lineCatalogMissing: catMissing, getAvailableServiceTypes, onPickService, onUpdateServiceLine, onDeleteServiceLine }: Props) {
  const options = getAvailableServiceTypes(line.unit_type_id || '', line.capacity_id || '')
  const hasConfig = !!line.unit_type_id && !!line.capacity_id
  const hasOptions = options.length > 0

  return (
    <div className="relative pl-4 border-l-2 border-primary/20 space-y-3 pb-4 last:pb-0 last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</span>
        {groupLength > 1 && (
          <Button variant="ghost" size="sm" onClick={() => onDeleteServiceLine(line.line_id)} className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs"><X className="h-3 w-3" />Hapus</Button>
        )}
      </div>

      <div>
        <Label className="text-[11px] font-medium">Jenis Service *</Label>
        <Select value={line.service_type_id || ''} disabled={!hasConfig} onValueChange={(stId) => onPickService(line.line_id, stId)}>
          <SelectTrigger className="h-9"><SelectValue placeholder={!hasConfig ? 'Pilih tipe unit & kapasitas dulu' : 'Pilih jenis service...'} /></SelectTrigger>
          <SelectContent>
            {!hasConfig ? null : !hasOptions ? (
              <SelectItem value="no_service_type" disabled className="text-[11px] text-warning dark:text-warning">Tidak ada jenis service untuk tipe unit + kapasitas ini.</SelectItem>
            ) : options.map((st) => (<SelectItem key={st.id} value={st.id}>{st.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-[11px] font-medium">Quantity</Label>
          <Input type="number" min={1} value={line.quantity} className="h-9" onChange={(e) => onUpdateServiceLine(line.line_id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
        </div>
        <div>
          <Label className="text-[11px] font-medium">Estimasi Harga (Rp)</Label>
          <Input type="number" min={0} value={line.estimated_price} className="h-9 font-medium" disabled={!line.service_type_id} onChange={(e) => onUpdateServiceLine(line.line_id, { estimated_price: Math.max(0, parseInt(e.target.value, 10) || 0), manual_price: true })} />
          {!line.manual_price && line.estimated_price > 0 && <p className="mt-1 flex items-center gap-1 text-[9px] text-success dark:text-success font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Sesuai harga katalog</p>}
          {catMissing && !line.manual_price && <p className="mt-1 flex items-center gap-1 text-[9px] text-warning dark:text-warning font-medium"><AlertTriangle className="h-2.5 w-2.5" />Belum ada harga katalog. Isi manual.</p>}
          {line.manual_price && (
            <div className="mt-1 flex items-center justify-between text-[9px] font-medium">
              <span className="flex items-center gap-0.5 text-warning dark:text-warning"><AlertTriangle className="h-2.5 w-2.5" />Manual</span>
              <button type="button" className="text-primary hover:underline" onClick={() => onUpdateServiceLine(line.line_id, { manual_price: false })}>Reset</button>
            </div>
          )}
        </div>
        <div>
          <Label className="text-[11px] font-medium text-muted-foreground/80">Subtotal</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-bold tracking-tight">{idrFmt(line.estimated_price * line.quantity)}</div>
        </div>
      </div>

      <div>
        <Label className="text-[11px] font-medium">Catatan Item (opsional)</Label>
        <Textarea rows={1} value={line.description || ''} onChange={(e) => onUpdateServiceLine(line.line_id, { description: e.target.value })} placeholder="Ruangan/posisi unit AC atau keluhan..." className="text-xs" />
      </div>
    </div>
  )
}
