'use client'

import React, { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { importCatalogCSV } from '@/lib/actions/bulk-import-catalog'
import type { ImportCatalogResult, ImportRowError } from '@/lib/catalog-csv'
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Loader2,
  UploadCloud,
} from 'lucide-react'

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess?: () => void
}

const CSV_HEADERS = [
  'unit_type_name',
  'capacity_label',
  'service_type_code',
  'msn_code',
  'service_name',
  'base_price',
  'includes',
] as const

const TEMPLATE_ROWS = [
  ['AC Split', '1/2 PK', 'CC', 'SPLIT-CC-05', 'Cuci AC Split 1/2 PK', '85000', 'Cek freon;Bersihkan filter'],
  ['AC Split', '1 PK', 'CC', 'SPLIT-CC-10', 'Cuci AC Split 1 PK', '95000', 'Cek freon;Bersihkan evaporator'],
]

function buildTemplateCsv(): string {
  const lines = [CSV_HEADERS.join(','), ...TEMPLATE_ROWS.map((r) => r.join(','))]
  return lines.join('\n') + '\n'
}

export function CsvImportDialog({ open, onOpenChange, onImportSuccess }: CsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>('')
  const [csvContent, setCsvContent] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportCatalogResult | null>(null)
  const [readError, setReadError] = useState<string>('')

  const resetState = () => {
    setFileName('')
    setCsvContent('')
    setResult(null)
    setReadError('')
    setIsImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState()
    onOpenChange(next)
  }

  const handleFile = (file: File) => {
    setResult(null)
    setReadError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        setCsvContent(text)
        setFileName(file.name)
      } else {
        setReadError('Gagal membaca file CSV.')
      }
    }
    reader.onerror = () => setReadError('Gagal membaca file CSV.')
    reader.readAsText(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'catalog-import-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSubmit = async () => {
    if (!csvContent.trim()) return
    setIsImporting(true)
    setResult(null)
    try {
      const res = await importCatalogCSV(csvContent)
      setResult(res)
      if (res.success && res.errors.length === 0) {
        onImportSuccess?.()
      }
    } catch (err) {
      setResult({
        success: false,
        importedCount: 0,
        errors: [],
        error: err instanceof Error ? err.message : 'Terjadi kesalahan saat import.',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const showSuccess = result?.success === true && result.errors.length === 0
  const errorRows: ImportRowError[] = result?.errors ?? []
  const topLevelError = result && !result.success ? result.error : undefined

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Katalog dari CSV</DialogTitle>
          <DialogDescription>
            Upload file CSV untuk menambahkan entri katalog secara massal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Butuh format? Unduh template CSV beserta contoh baris.</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4" />
              Template
            </Button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 p-6 text-center transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Upload CSV"
            />
            <div className="rounded-full bg-muted p-3">
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Klik untuk pilih file CSV</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kolom: {CSV_HEADERS.join(', ')}
              </p>
            </div>
          </button>

          {fileName && !readError ? (
            <p className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
            </p>
          ) : null}

          {readError ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{readError}</span>
            </div>
          ) : null}

          {showSuccess ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span>{result?.importedCount ?? 0} rows imported successfully</span>
            </div>
          ) : null}

          {topLevelError ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{topLevelError}</span>
            </div>
          ) : null}

          {errorRows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {result?.importedCount ?? 0} baris diimpor, {errorRows.length} baris gagal
                </span>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-2 text-xs">
                {errorRows.map((err, i) => (
                  <li
                    key={`${err.rowNumber}-${err.msn_code}-${i}`}
                    className="flex flex-col rounded-md bg-background/60 px-2 py-1.5"
                  >
                    <span className="font-medium text-foreground">
                      Baris {err.rowNumber}
                      {err.msn_code ? ` · ${err.msn_code}` : ''}
                    </span>
                    <span className="text-muted-foreground">{err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Tutup
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isImporting || !csvContent.trim()}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CsvImportDialog
