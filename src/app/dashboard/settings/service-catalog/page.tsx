'use client'

import { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import ServicePricingPage from '@/app/dashboard/konfigurasi/service-pricing/page'
import ServiceConfigPage from '@/app/dashboard/konfigurasi/service-config/page'

/**
 * Phase 1: tabbed shell that embeds the existing service-pricing and service-config pages
 * under the new Settings → Service Catalog route. Phase 3 will merge these into a single
 * unified catalog data model.
 */
export default function ServiceCatalogPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Daftar service dan pricing yang tersedia
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-4 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Service Pricing dan Service Config akan digabung menjadi satu data model di Phase 3.
            Untuk sekarang gunakan tab di bawah.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="pricing" className="mt-4">
          <Suspense fallback={null}>
            <ServicePricingPage />
          </Suspense>
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <Suspense fallback={null}>
            <ServiceConfigPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
