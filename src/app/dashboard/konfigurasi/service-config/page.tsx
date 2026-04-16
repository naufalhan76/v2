'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UnitTypeTab } from './components/UnitTypeTab'
import { CapacityTab } from './components/CapacityTab'
import { BrandTab } from './components/BrandTab'
import { ServiceTypeTab } from './components/ServiceTypeTab'
import { ServiceCatalogTab } from './components/ServiceCatalogTab'
import { AddonsTab } from './components/AddonsTab'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Info } from 'lucide-react'

export default function ServiceConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Konfigurasi Service</h1>
        <p className="text-muted-foreground">
          Kelola master data harga service, spesifikasi AC, dan katalog addons
        </p>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-4 border border-blue-200 dark:border-blue-900 rounded-lg flex gap-3 text-sm">
         <Info className="h-5 w-5 shrink-0" />
         <div>
            <span className="font-semibold">Informasi Hierarki Harga:</span> Harga service ditentukan dari kombinasi <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">Unit Type &rarr; Capacity &rarr; Tipe Service</span>. Fitur <b>Bulk Import</b> dengan format Excel tersedia di tab Service Catalog.
         </div>
      </div>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="w-full flex justify-start overflow-x-auto overflow-y-hidden mb-4 bg-muted/50 p-1">
          <TabsTrigger value="catalog" className="flex-1 max-w-[200px]">Service Catalog</TabsTrigger>
          <TabsTrigger value="unit" className="flex-1 max-w-[150px]">Unit Type</TabsTrigger>
          <TabsTrigger value="capacity" className="flex-1 max-w-[150px]">Capacity</TabsTrigger>
          <TabsTrigger value="servicetype" className="flex-1 max-w-[150px]">Master Service</TabsTrigger>
          <TabsTrigger value="brand" className="flex-1 max-w-[150px]">Merk AC</TabsTrigger>
          <TabsTrigger value="addons" className="flex-1 max-w-[150px]">Add-Ons</TabsTrigger>
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

        <TabsContent value="addons" className="mt-0 pt-2">
          <Card>
             <CardHeader>
               <CardTitle>Master Data Add-ons</CardTitle>
               <CardDescription>Kelola parts, freon, labor terpisah dari Jasa Service</CardDescription>
             </CardHeader>
          </Card>
          <div className="mt-4"><AddonsTab /></div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
