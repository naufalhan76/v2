'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'

import { createOrderWithItems, getOrderConfigMasterData, getTechnicians } from '@/lib/actions/orders'
import { createProformaInvoice } from '@/lib/actions/invoices'
import { normalizeOrderServiceType } from '@/lib/service-types'
import type { CustomerSearchResult } from '@/types/orders'
import { useServiceLines, type SelectedAcLine } from './use-service-lines'

type LocationLite = NonNullable<CustomerSearchResult['locations']>[number]
type AcUnitLite = NonNullable<LocationLite['ac_units']>[number]

const formatLocationLabel = (loc: Pick<LocationLite, 'full_address' | 'house_number' | 'city'>) => {
  const parts = [loc.full_address, loc.house_number ? `No ${loc.house_number}` : null, loc.city]
    .filter(Boolean)
  return parts.join(', ')
}

const formatAcLabel = (ac: AcUnitLite) =>
  [ac.brand, ac.model_number, ac.serial_number ? `(${ac.serial_number})` : null]
    .filter(Boolean)
    .join(' ')

export function useCreateOrderForm(customer: CustomerSearchResult | null) {
  const router = useRouter()
  const { toast } = useToast()

  const [openSection, setOpenSection] = useState<string>('section-customer')
  const [selectedAcs, setSelectedAcs] = useState<Record<string, string[]>>({})
  const [showNewLocationForm, setShowNewLocationForm] = useState(false)
  const [newAcCounter, setNewAcCounter] = useState(0)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [skipAssignment, setSkipAssignment] = useState(true)
  const [leadTechnicianId, setLeadTechnicianId] = useState<string>('')
  const [helperTechnicianIds, setHelperTechnicianIds] = useState<string[]>([])
  const [today, setToday] = useState<Date | undefined>()
  useEffect(() => { setToday(new Date(new Date().setHours(0, 0, 0, 0))) }, [])
  const [orderNotes, setOrderNotes] = useState('')
  const [createProforma, setCreateProforma] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: masterData } = useQuery({
    queryKey: ['order-config-master-data'],
    queryFn: async () => {
      const res = await getOrderConfigMasterData()
      if (!res.success || !res.data) throw new Error(res.error || 'Gagal memuat master data')
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const res = await getTechnicians()
      if (!res.success || !res.data) return []
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const {
    serviceLines, setServiceLines, lineCatalogMissing,
    getAvailableServiceTypesForLine, updateServiceLine,
    updateServiceLineForGroup, pickServiceForLine,
    uniqueUnitInstanceIds, totalEstimatedPrice,
  } = useServiceLines(masterData)

  const resetFormForNewCustomer = () => { setSelectedAcs({}); setServiceLines([]) }

  const toggleAc = (locationId: string, acUnitId: string) => {
    const exists = serviceLines.some((l) => l.location_id === locationId && l.ac_unit_id === acUnitId)
    setSelectedAcs((prev) => {
      const current = prev[locationId] || []
      const next = current.includes(acUnitId) ? current.filter((id) => id !== acUnitId) : [...current, acUnitId]
      const out = { ...prev, [locationId]: next }
      if (next.length === 0) delete out[locationId]
      return out
    })
    if (exists) {
      setServiceLines((prev) => prev.filter((l) => !(l.location_id === locationId && l.ac_unit_id === acUnitId)))
    } else {
      const loc = customer?.locations?.find((l) => l.location_id === locationId)
      const ac = loc?.ac_units?.find((a) => a.ac_unit_id === acUnitId)
      if (loc && ac) {
        setServiceLines((prev) => [...prev, {
          line_id: `${locationId}:${acUnitId}:${Date.now()}`, unit_instance_id: acUnitId,
          location_id: locationId, ac_unit_id: acUnitId, location_label: formatLocationLabel(loc),
          ac_label: formatAcLabel(ac), service_type_id: '', service_type_code: '', service_name: '',
          estimated_price: 0, manual_price: false, description: '', quantity: 1,
          unit_type_id: ac.unit_type_id || '', capacity_id: ac.capacity_id || '',
        }])
      }
    }
  }

  const addNewAcLine = (locationId: string) => {
    setNewAcCounter((c) => c + 1)
    const loc = customer?.locations?.find((l) => l.location_id === locationId)
    if (!loc) return
    const now = Date.now()
    const count = Array.from(new Set(serviceLines.filter(
      (l) => l.location_id === locationId && l.ac_unit_id === '__new__',
    ).map((l) => l.unit_instance_id))).length
    setServiceLines((prev) => [...prev, {
      line_id: `${locationId}:__new__:${now}:${newAcCounter}`, unit_instance_id: `new-ac-${locationId}-${now}-${newAcCounter}`,
      location_id: locationId, ac_unit_id: '__new__', location_label: formatLocationLabel(loc),
      ac_label: `AC Baru #${count + 1}`, service_type_id: '', service_type_code: '', service_name: '',
      estimated_price: 0, manual_price: false, description: '', quantity: 1, unit_type_id: '', capacity_id: '',
    }])
  }

  const addServiceLineToGroup = (unitInstanceId: string) => {
    const firstLine = serviceLines.find((l) => l.unit_instance_id === unitInstanceId)
    if (!firstLine) return
    setServiceLines((prev) => [...prev, {
      line_id: `${firstLine.location_id}:${firstLine.ac_unit_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      unit_instance_id: unitInstanceId, location_id: firstLine.location_id, ac_unit_id: firstLine.ac_unit_id,
      location_label: firstLine.location_label, ac_label: firstLine.ac_label,
      service_type_id: '', service_type_code: '', service_name: '', estimated_price: 0,
      manual_price: false, description: '', quantity: 1,
      unit_type_id: firstLine.unit_type_id || '', capacity_id: firstLine.capacity_id || '',
    }])
  }

  const deleteServiceLine = (lineId: string) => {
    const lineToRemove = serviceLines.find((l) => l.line_id === lineId)
    if (!lineToRemove) return
    const remaining = serviceLines.filter((l) => l.unit_instance_id === lineToRemove.unit_instance_id && l.line_id !== lineId)
    if (remaining.length === 0) {
      setSelectedAcs((prev) => {
        const current = prev[lineToRemove.location_id] || []
        const next = current.filter((id) => id !== lineToRemove.ac_unit_id)
        const out = { ...prev, [lineToRemove.location_id]: next }
        if (next.length === 0) delete out[lineToRemove.location_id]
        return out
      })
    }
    setServiceLines((prev) => prev.filter((l) => l.line_id !== lineId))
  }

  const newAcCount = useMemo(() => new Set(serviceLines.filter((l) => l.ac_unit_id === '__new__').map((l) => l.unit_instance_id)).size, [serviceLines])
  const existingAcCount = useMemo(() => new Set(serviceLines.filter((l) => l.ac_unit_id !== '__new__').map((l) => l.unit_instance_id)).size, [serviceLines])

  const isCustomerFilled = !!customer
  const isLocationsFilled = serviceLines.length > 0
  const isServicesFilled = serviceLines.length > 0 && serviceLines.every((l) => !!l.service_type_id && !!l.unit_type_id && !!l.capacity_id)
  const isScheduleFilled = !!scheduledDate && (skipAssignment || !!leadTechnicianId)
  const completedSections = [isCustomerFilled, isLocationsFilled, isServicesFilled, isScheduleFilled].filter(Boolean).length
  const progressPct = (completedSections / 4) * 100

  const handleSubmit = async () => {
    if (!customer) { toast({ title: 'Customer belum dipilih', variant: 'destructive' }); setOpenSection('section-customer'); return }
    if (!isLocationsFilled) { toast({ title: 'Belum ada AC yang dipilih', variant: 'destructive' }); setOpenSection('section-locations'); return }
    if (!isServicesFilled) { toast({ title: 'Pilih jenis service untuk semua AC', variant: 'destructive' }); setOpenSection('section-services'); return }
    if (!scheduledDate) { toast({ title: 'Tentukan tanggal kunjungan', variant: 'destructive' }); setOpenSection('section-schedule'); return }
    if (!skipAssignment && !leadTechnicianId) { toast({ title: 'Pilih teknisi atau klik "Assign nanti"', variant: 'destructive' }); setOpenSection('section-schedule'); return }

    setSubmitting(true)
    try {
      const items = serviceLines.map((l) => ({
        location_id: l.location_id, ac_unit_id: l.ac_unit_id === '__new__' ? null : l.ac_unit_id,
        new_ac_temp_id: l.ac_unit_id === '__new__' ? l.unit_instance_id : undefined,
        service_type_id: l.service_type_id, service_type: normalizeOrderServiceType(l.service_type_code),
        quantity: l.quantity, description: l.description || undefined, estimated_price: l.estimated_price,
        unit_type_id: l.unit_type_id || undefined, capacity_id: l.capacity_id || undefined,
        catalog_id: l.catalog_id || undefined, msn_code: l.msn_code || undefined,
      }))
      const orderRes = await createOrderWithItems({
        customer_id: customer.customer_id, scheduled_visit_date: format(scheduledDate, 'yyyy-MM-dd'),
        assigned_technician_id: skipAssignment ? null : leadTechnicianId || null,
        helper_technician_ids: !skipAssignment && helperTechnicianIds.length > 0 ? helperTechnicianIds : undefined,
        notes: orderNotes || undefined, items,
      })
      if (!orderRes.success || !orderRes.data) throw new Error(orderRes.error || 'Gagal membuat order')
      const orderId = orderRes.data.order_id
      if (createProforma) {
        const proformaRes = await createProformaInvoice(orderId)
        if (proformaRes.success && proformaRes.data) {
          toast({ title: 'Order dan Proforma berhasil dibuat', description: `Invoice ${proformaRes.data.invoice_number}` })
          router.push(`/dashboard/keuangan/invoices/${proformaRes.data.invoice_id}?proforma=true`); return
        }
        toast({ title: 'Order dibuat, tapi proforma gagal', description: proformaRes.error || 'Cek kembali konfigurasi invoice', variant: 'destructive' })
        router.push('/dashboard/orders'); return
      }
      toast({ title: 'Order berhasil dibuat' }); router.push('/dashboard/orders')
    } catch (err) {
      toast({ title: 'Gagal membuat order', description: err instanceof Error ? err.message : 'Terjadi kesalahan', variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  return {
    openSection, setOpenSection, resetFormForNewCustomer,
    selectedAcs, showNewLocationForm, setShowNewLocationForm,
    serviceLines, setServiceLines, lineCatalogMissing,
    getAvailableServiceTypesForLine, updateServiceLine, updateServiceLineForGroup,
    addServiceLineToGroup, deleteServiceLine, pickServiceForLine,
    toggleAc, addNewAcLine,
    scheduledDate, setScheduledDate, skipAssignment, setSkipAssignment,
    leadTechnicianId, setLeadTechnicianId, helperTechnicianIds, setHelperTechnicianIds,
    today, orderNotes, setOrderNotes,
    createProforma, setCreateProforma, submitting, handleSubmit,
    masterData, technicians,
    uniqueUnitInstanceIds, totalEstimatedPrice, newAcCount, existingAcCount,
    isCustomerFilled, isLocationsFilled, isServicesFilled, isScheduleFilled, completedSections, progressPct,
  }
}

export { formatLocationLabel, formatAcLabel }
export type { SelectedAcLine }
