'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalogTab } from './components/ServiceCatalogTab'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info, Settings } from 'lucide-react'

const UnitTypeTab = dynamic(() => import('./components/UnitTypeTab').then((mod) => mod.UnitTypeTab))
const CapacityTab = dynamic(() => import('./components/CapacityTab').then((mod) => mod.CapacityTab))
const BrandTab = dynamic(() => import('./components/BrandTab').then((mod) => mod.BrandTab))
const ServiceTypeTab = dynamic(() => import('./components/ServiceTypeTab').then((mod) => mod.ServiceTypeTab))

const TABS = [
  { value: 'catalog', label: 'Katalog Service', description: 'Harga & kombinasi service' },
  { value: 'unit', label: 'Tipe Unit', description: 'Jenis AC (Split, Cassette, dll)' },
  { value: 'capacity', label: 'Kapasitas', description: 'PK & BTU ranges' },
  { value: 'servicetype', label: 'Jenis Service', description: 'Standar, Deep Clean, dll' },
  { value: 'brand', label: 'Merk AC', description: 'Daftar merek' },
]

export default function ServiceConfigPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Konfigurasi Service</h1>
          <p className="text-muted-foreground mt-1">
            Kelola master data harga service, spesifikasi AC, dan katalog addons
          </p>
        </div>
        <Settings className="h-5 w-5 text-muted-foreground" />
      </div>

      <Alert className="rounded-xl border border-border/50 bg-muted/30 shadow-none">
        <Info className="h-4 w-4 mt-0.5" />
        <AlertTitle className="text-sm font-semibold">Hierarki Harga</AlertTitle>
        <AlertDescription className="text-sm leading-relaxed">
          Harga service ditentukan dari kombinasi{' '}
          <span className="font-mono rounded bg-background px-1.5 py-0.5 text-xs border border-border/50">
            Tipe Unit → Kapasitas → Jenis Service
          </span>
          . Fitur <strong>Bulk Import</strong> dan <strong>Bulk Update</strong> tersedia di tab Katalog Service.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="mb-4 flex w-full justify-start overflow-x-auto overflow-y-hidden rounded-xl border border-border/50 bg-muted/50 p-1 gap-1">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 max-w-[180px] rounded-lg text-sm font-medium"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="catalog" className="mt-0">
          <ServiceCatalogTab />
        </TabsContent>

        <TabsContent value="unit" className="mt-0">
          <UnitTypeTab />
        </TabsContent>

        <TabsContent value="capacity" className="mt-0">
          <CapacityTab />
        </TabsContent>

        <TabsContent value="servicetype" className="mt-0">
          <ServiceTypeTab />
        </TabsContent>

        <TabsContent value="brand" className="mt-0">
          <BrandTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
