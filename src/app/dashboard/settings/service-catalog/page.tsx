'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Upload } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CatalogGroupAccordion } from '@/components/catalog/catalog-group-accordion'
import { CsvImportDialog } from '@/components/catalog/csv-import-dialog'

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient()
  const [csvDialogOpen, setCsvDialogOpen] = useState(false)

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['service-catalog-grouped'] })
    queryClient.invalidateQueries({ queryKey: ['service-catalog'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold">Service Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Master data layanan: kombinasi MSN code, unit type, kapasitas, dan harga.
          </p>
        </div>
        <Button
          onClick={() => setCsvDialogOpen(true)}
          variant="outline"
          className="gap-2 w-full sm:w-auto"
        >
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="pt-4 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Halaman ini menggantikan <strong>Service Config</strong>. Seluruh
            data layanan kini terpusat di tabel{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/40">
              service_catalog
            </code>
            .
          </p>
        </CardContent>
      </Card>

      <CatalogGroupAccordion />

      <CsvImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  )
}
