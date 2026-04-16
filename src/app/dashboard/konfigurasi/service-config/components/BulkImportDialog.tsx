'use client'

import React, { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UploadCloud, FileType2 } from 'lucide-react'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  placeholder: string
  onImport: (csvText: string) => Promise<void>
  isLoading?: boolean
}

export function BulkImportDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  onImport,
  isLoading
}: BulkImportDialogProps) {
  const [csvText, setCsvText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      // Not strict checking, but just a good UX consideration
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        setCsvText(text)
      }
    }
    reader.readAsText(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    await onImport(csvText)
    setCsvText('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground mt-2">{description}</div>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".csv,text/csv" 
              className="hidden" 
            />
            <div className="flex flex-col items-center justify-center gap-2 cursor-pointer">
              <div className="p-3 bg-muted rounded-full">
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Klik untuk upload CSV atau Drag & Drop file kesini</p>
                <p className="text-xs text-muted-foreground mt-1">Ukuran maksimal file direkomendasikan 5MB</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Atau paste data CSV/Excel manual di bawah</span>
            </div>
          </div>

          <Textarea 
            placeholder={placeholder} 
            className="min-h-[250px] font-mono text-xs whitespace-pre" 
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
        </div>

        <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
          Pastikan header CSV ada di baris pertama dan menggunakan pemisah koma (,) atau TAB.
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !csvText.trim()}>
            {isLoading ? 'Importing...' : 'Start Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
