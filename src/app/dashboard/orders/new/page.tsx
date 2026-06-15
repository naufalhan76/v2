'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, CheckCircle2, ChevronRight, ClipboardList, MapPin, Package, User, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-state'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

import { useCustomerSearch, type CustomerSuggestion } from './_hooks/use-customer-search'
import { useCreateOrderForm, formatLocationLabel } from './_hooks/use-create-order-form'
import type { NewCustomerInput } from './_components/customer-search-step'
import type { CustomerSearchResult } from '@/types/orders'
import type { LocationLite } from './_components/location-step'
import { CustomerSearchStep } from './_components/customer-search-step'
import { LocationStep } from './_components/location-step'
import { ServiceSelectionStep } from './_components/service-selection-step'
import { SchedulingStep } from './_components/scheduling-step'
import { OrderSummary } from './_components/order-summary'
import { ProformaOptions } from './_components/proforma-options'

export default function NewOrderPage() {
  const router = useRouter()
  const { customer, setCustomer, searchQuery, setSearchQuery, showNewCustomerForm, setShowNewCustomerForm, customerSuggestions, searchingCustomers, handlePickCustomerSuggestion, handleCustomerCreated, clearCustomer, createNewCustomer } = useCustomerSearch()
  const form = useCreateOrderForm(customer)

  const handlePickSuggestion = async (s: CustomerSuggestion) => {
    await handlePickCustomerSuggestion(s)
    form.setOpenSection('section-locations')
  }

  const handleCreateCustomer = async (v: NewCustomerInput) => {
    const r = await createNewCustomer(v)
    if (r) { handleCustomerCreated(r); form.setOpenSection('section-locations') }
  }

  const handleLocationCreated = (loc: LocationLite) => {
    setCustomer((prev) => prev ? { ...prev, locations: [...(prev.locations || []), loc] } : prev)
  }

  const progressPct = (form.completedSections / 4) * 100

  return (
    <div className="p-4 md:p-6">
      <LoadingOverlay isLoading={form.submitting} message="Menyimpan order..." fullscreen autoFocus>
        <PageHeader completedSections={form.completedSections} progressPct={progressPct} />
        <Accordion type="single" collapsible value={form.openSection} onValueChange={(v) => form.setOpenSection(v || '')} className="space-y-3">
          <CustomerSection filled={form.isCustomerFilled} customer={customer}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery} showNewCustomerForm={showNewCustomerForm} setShowNewCustomerForm={setShowNewCustomerForm} customerSuggestions={customerSuggestions} searchingCustomers={searchingCustomers} onPickCustomer={handlePickSuggestion} onCreateCustomer={handleCreateCustomer} />
          <LocationSection filled={form.isCustomerFilled} isLocationsFilled={form.isLocationsFilled} customer={customer} selectedAcs={form.selectedAcs} serviceLines={form.serviceLines} showNewLocationForm={form.showNewLocationForm} setShowNewLocationForm={form.setShowNewLocationForm} onToggleAc={form.toggleAc} onAddNewAcLine={form.addNewAcLine} onRemoveServiceLine={form.deleteServiceLine} onCustomerWithNewLocation={setCustomer} onNavigateNext={() => form.setOpenSection('section-services')} newAcCount={form.newAcCount} existingAcCount={form.existingAcCount} />
          <ServiceSection isLocationsFilled={form.isLocationsFilled} isServicesFilled={form.isServicesFilled} uniqueUnitInstanceIds={form.uniqueUnitInstanceIds} serviceLines={form.serviceLines} lineCatalogMissing={form.lineCatalogMissing} masterData={form.masterData} onPickService={form.pickServiceForLine} onUpdateServiceLine={form.updateServiceLine} onUpdateServiceLineForGroup={form.updateServiceLineForGroup} onAddServiceLine={form.addServiceLineToGroup} onDeleteServiceLine={form.deleteServiceLine} getAvailableServiceTypes={form.getAvailableServiceTypesForLine} totalEstimatedPrice={form.totalEstimatedPrice} onNavigateNext={() => form.setOpenSection('section-schedule')} />
          <ScheduleSection isServicesFilled={form.isServicesFilled} isScheduleFilled={form.isScheduleFilled} scheduledDate={form.scheduledDate} setScheduledDate={form.setScheduledDate} today={form.today} skipAssignment={form.skipAssignment} setSkipAssignment={form.setSkipAssignment} leadTechnicianId={form.leadTechnicianId} setLeadTechnicianId={form.setLeadTechnicianId} helperTechnicianIds={form.helperTechnicianIds} setHelperTechnicianIds={form.setHelperTechnicianIds} technicians={form.technicians} orderNotes={form.orderNotes} setOrderNotes={form.setOrderNotes} onNavigateNext={() => form.setOpenSection('section-review')} />
          <ReviewSection isScheduleFilled={form.isScheduleFilled} customer={customer} scheduledDate={form.scheduledDate} skipAssignment={form.skipAssignment} leadTechnicianId={form.leadTechnicianId} helperTechnicianIds={form.helperTechnicianIds} technicians={form.technicians} serviceLines={form.serviceLines} totalEstimatedPrice={form.totalEstimatedPrice} createProforma={form.createProforma} setCreateProforma={form.setCreateProforma} submitting={form.submitting} handleSubmit={form.handleSubmit} router={router} />
        </Accordion>
      </LoadingOverlay>
    </div>
  )
}

// ---------- Inline sub-components to keep page thin ----------

function PageHeader({ completedSections, progressPct }: { completedSections: number; progressPct: number }) {
  return (
    <div className="mb-4 sm:mb-6 space-y-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/dashboard/orders" className="inline-flex items-center gap-1 hover:text-foreground transition-colors"><ClipboardList className="h-3.5 w-3.5" />Orders</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Buat Order Baru</span>
      </nav>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl md:text-3xl tracking-tight">Buat Order Baru</h1>
          <p className="text-sm text-muted-foreground mt-1">Isi setiap section secara berurutan.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{completedSections}/4 section</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={completedSections} aria-valuemin={0} aria-valuemax={4}><div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }} /></div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, step, title, filled, summary }: { icon: React.ReactNode; step: number; title: string; filled: boolean; summary: string }) {
  return (
    <div className="flex w-full items-center gap-3 pr-2">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', filled ? 'border-success bg-success text-white' : 'border-muted-foreground/30')}>
        {filled ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1 text-left"><p className="font-semibold">{title}</p><p className="truncate text-xs text-muted-foreground">{summary}</p></div>
    </div>
  )
}

function CustomerSection({ filled, customer, searchQuery, setSearchQuery, showNewCustomerForm, setShowNewCustomerForm, customerSuggestions, searchingCustomers, onPickCustomer, onCreateCustomer }: { filled: boolean; customer: CustomerSearchResult | null; searchQuery: string; setSearchQuery: (v: string) => void; showNewCustomerForm: boolean; setShowNewCustomerForm: (v: boolean) => void; customerSuggestions: CustomerSuggestion[]; searchingCustomers: boolean; onPickCustomer: (s: CustomerSuggestion) => void; onCreateCustomer: (v: NewCustomerInput) => Promise<void> }) {
  return (
    <AccordionItem value="section-customer" className="rounded-md border bg-card px-3 sm:px-4">
      <AccordionTrigger className="hover:no-underline"><SectionHeader icon={<User className="h-5 w-5" />} step={1} title="Customer" filled={filled} summary={customer ? `${customer.customer_name} • ${customer.phone_number}` : 'Cari atau buat customer baru'} /></AccordionTrigger>
      <AccordionContent><CustomerSearchStep customer={customer} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} showNewCustomerForm={showNewCustomerForm} onShowNewCustomerFormChange={setShowNewCustomerForm} customerSuggestions={customerSuggestions} searchingCustomers={searchingCustomers} onPickCustomer={onPickCustomer} onCreateCustomer={onCreateCustomer} /></AccordionContent>
    </AccordionItem>
  )
}

function LocationSection({ filled, isLocationsFilled, customer, selectedAcs, serviceLines, showNewLocationForm, setShowNewLocationForm, onToggleAc, onAddNewAcLine, onRemoveServiceLine, onCustomerWithNewLocation, onNavigateNext, newAcCount, existingAcCount }: { filled: boolean; isLocationsFilled: boolean; customer: CustomerSearchResult | null; selectedAcs: Record<string, string[]>; serviceLines: Array<{ line_id: string; unit_instance_id: string; location_id: string; ac_unit_id: string; ac_label: string }>; showNewLocationForm: boolean; setShowNewLocationForm: (v: boolean) => void; onToggleAc: (loc: string, ac: string) => void; onAddNewAcLine: (loc: string) => void; onRemoveServiceLine: (id: string) => void; onCustomerWithNewLocation: React.Dispatch<React.SetStateAction<CustomerSearchResult | null>>; onNavigateNext: () => void; newAcCount: number; existingAcCount: number }) {
  return (
    <AccordionItem value="section-locations" className={cn('rounded-md border bg-card px-3 sm:px-4', !filled && 'pointer-events-none opacity-60')}>
      <AccordionTrigger className="hover:no-underline"><SectionHeader icon={<MapPin className="h-5 w-5" />} step={2} title="Lokasi & Unit AC" filled={isLocationsFilled} summary={isLocationsFilled ? `${serviceLines.length} unit AC dari ${new Set(serviceLines.map((l) => l.location_id)).size} lokasi • ${newAcCount} baru • ${existingAcCount} existing` : 'Pilih lokasi dan unit AC yang akan diservice'} /></AccordionTrigger>
      <AccordionContent><LocationStep customer={customer} selectedAcs={selectedAcs} serviceLines={serviceLines} showNewLocationForm={showNewLocationForm} onShowNewLocationFormChange={setShowNewLocationForm} onToggleAc={onToggleAc} onAddNewAcLine={onAddNewAcLine} onRemoveServiceLine={onRemoveServiceLine} onCustomerWithNewLocation={onCustomerWithNewLocation} onNavigateNext={onNavigateNext} isFilled={isLocationsFilled} formatLocationLabel={formatLocationLabel} /></AccordionContent>
    </AccordionItem>
  )
}

function ServiceSection({ isLocationsFilled, isServicesFilled, uniqueUnitInstanceIds, serviceLines, lineCatalogMissing, masterData, onPickService, onUpdateServiceLine, onUpdateServiceLineForGroup, onAddServiceLine, onDeleteServiceLine, getAvailableServiceTypes, totalEstimatedPrice, onNavigateNext }: { isLocationsFilled: boolean; isServicesFilled: boolean; uniqueUnitInstanceIds: string[]; serviceLines: Array<{ line_id: string; unit_instance_id: string; location_id: string; ac_unit_id: string; ac_label: string; location_label: string; service_type_id: string; service_type_code: string; service_name: string; estimated_price: number; manual_price: boolean; description?: string; quantity: number; unit_type_id?: string; capacity_id?: string }>; lineCatalogMissing: Record<string, boolean>; masterData: Record<string, unknown> | undefined; onPickService: (id: string, stId: string) => void; onUpdateServiceLine: (id: string, p: Record<string, unknown>) => void; onUpdateServiceLineForGroup: (id: string, p: Record<string, unknown>) => void; onAddServiceLine: (id: string) => void; onDeleteServiceLine: (id: string) => void; getAvailableServiceTypes: (u: string, c: string) => Array<{ id: string; label: string }>; totalEstimatedPrice: number; onNavigateNext: () => void }) {
  const idrFmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
  return (
    <AccordionItem value="section-services" className={cn('rounded-md border bg-card px-3 sm:px-4', !isLocationsFilled && 'pointer-events-none opacity-60')}>
      <AccordionTrigger className="hover:no-underline"><SectionHeader icon={<Wrench className="h-5 w-5" />} step={3} title="Service Items" filled={isServicesFilled} summary={isServicesFilled ? `${serviceLines.length} service • Total estimasi ${idrFmt(totalEstimatedPrice)}` : 'Pilih jenis service untuk setiap AC'} /></AccordionTrigger>
      <AccordionContent><ServiceSelectionStep uniqueUnitInstanceIds={uniqueUnitInstanceIds} serviceLines={serviceLines} lineCatalogMissing={lineCatalogMissing} masterData={masterData} onPickService={onPickService} onUpdateServiceLine={onUpdateServiceLine} onUpdateServiceLineForGroup={onUpdateServiceLineForGroup} onAddServiceLine={onAddServiceLine} onDeleteServiceLine={onDeleteServiceLine} getAvailableServiceTypes={getAvailableServiceTypes} totalEstimatedPrice={totalEstimatedPrice} isServicesFilled={isServicesFilled} onNavigateNext={onNavigateNext} /></AccordionContent>
    </AccordionItem>
  )
}

function ScheduleSection({ isServicesFilled, isScheduleFilled, scheduledDate, setScheduledDate, today, skipAssignment, setSkipAssignment, leadTechnicianId, setLeadTechnicianId, helperTechnicianIds, setHelperTechnicianIds, technicians, orderNotes, setOrderNotes, onNavigateNext }: { isServicesFilled: boolean; isScheduleFilled: boolean; scheduledDate: Date | undefined; setScheduledDate: (d: Date | undefined) => void; today: Date | undefined; skipAssignment: boolean; setSkipAssignment: (v: boolean) => void; leadTechnicianId: string; setLeadTechnicianId: (v: string) => void; helperTechnicianIds: string[]; setHelperTechnicianIds: (v: string[]) => void; technicians: Array<{ technician_id: string; full_name: string }> | undefined; orderNotes: string; setOrderNotes: (v: string) => void; onNavigateNext: () => void }) {
  return (
    <AccordionItem value="section-schedule" className={cn('rounded-md border bg-card px-3 sm:px-4', !isServicesFilled && 'pointer-events-none opacity-60')}>
      <AccordionTrigger className="hover:no-underline"><SectionHeader icon={<CalendarIcon className="h-5 w-5" />} step={4} title="Jadwal & Penugasan" filled={isScheduleFilled} summary={isScheduleFilled ? `${format(scheduledDate!, 'dd MMM yyyy')}${skipAssignment ? ' • Belum ditugaskan' : ` • ${technicians?.find((t) => t.technician_id === leadTechnicianId)?.full_name || 'Teknisi'}`}` : 'Tentukan tanggal kunjungan dan penugasan teknisi'} /></AccordionTrigger>
      <AccordionContent><SchedulingStep scheduledDate={scheduledDate} onScheduledDateChange={setScheduledDate} today={today} skipAssignment={skipAssignment} onSkipAssignmentChange={setSkipAssignment} leadTechnicianId={leadTechnicianId} onLeadTechnicianChange={setLeadTechnicianId} helperTechnicianIds={helperTechnicianIds} onHelperChange={setHelperTechnicianIds} technicians={technicians} orderNotes={orderNotes} onNotesChange={setOrderNotes} isScheduleFilled={isScheduleFilled} onNavigateNext={onNavigateNext} /></AccordionContent>
    </AccordionItem>
  )
}

function ReviewSection({ isScheduleFilled, customer, scheduledDate, skipAssignment, leadTechnicianId, helperTechnicianIds, technicians, serviceLines, totalEstimatedPrice, createProforma, setCreateProforma, submitting, handleSubmit, router }: { isScheduleFilled: boolean; customer: CustomerSearchResult | null; scheduledDate: Date | undefined; skipAssignment: boolean; leadTechnicianId: string; helperTechnicianIds: string[]; technicians: Array<{ technician_id: string; full_name: string }> | undefined; serviceLines: Array<{ line_id: string; unit_instance_id: string; location_id: string; ac_unit_id: string; ac_label: string; location_label: string; service_type_id: string; service_type_code: string; service_name: string; estimated_price: number; manual_price: boolean; description?: string; quantity: number; unit_type_id?: string; capacity_id?: string }>; totalEstimatedPrice: number; createProforma: boolean; setCreateProforma: (v: boolean) => void; submitting: boolean; handleSubmit: () => Promise<void>; router: ReturnType<typeof useRouter> }) {
  const idrFmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
  return (
    <AccordionItem value="section-review" className={cn('rounded-md border bg-card px-3 sm:px-4', !isScheduleFilled && 'pointer-events-none opacity-60')}>
      <AccordionTrigger className="hover:no-underline"><SectionHeader icon={<Package className="h-5 w-5" />} step={5} title="Review & Submit" filled={false} summary={`Total estimasi ${idrFmt(totalEstimatedPrice)}`} /></AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          <OrderSummary customer={customer} scheduledDate={scheduledDate} skipAssignment={skipAssignment} leadTechnicianId={leadTechnicianId} helperTechnicianIds={helperTechnicianIds} technicians={technicians} serviceLines={serviceLines} totalEstimatedPrice={totalEstimatedPrice} />
          <ProformaOptions createProforma={createProforma} onProformaChange={setCreateProforma} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => router.back()} disabled={submitting} className="h-11 w-full sm:h-9 sm:w-auto">Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="h-11 w-full sm:h-9 sm:w-auto">{createProforma ? 'Buat Order + Proforma' : 'Buat Order'}</Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
