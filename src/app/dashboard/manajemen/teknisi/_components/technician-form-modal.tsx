'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Technician } from './technician-table'

interface TechnicianFormData {
  technician_name: string
  contact_number: string
  email: string
  password: string
  company: string
}

interface TechnicianFormModalProps {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  technician: Technician | null
  formData: TechnicianFormData
  onFormDataChange: (data: TechnicianFormData) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
}

const emptyFormData: TechnicianFormData = {
  technician_name: '',
  contact_number: '',
  email: '',
  password: '',
  company: '',
}

export function TechnicianFormModal({
  mode,
  open,
  onOpenChange,
  technician,
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
}: TechnicianFormModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isCreate = mode === 'create'

  const title = isCreate ? 'Add New Technician' : 'Edit Technician'
  const description = isCreate
    ? 'Create a new technician profile'
    : 'Update technician information'
  const submitLabel = isCreate ? 'Create Technician' : 'Update Technician'
  const submittingLabel = isCreate ? 'Creating...' : 'Updating...'

  const updateField = (field: keyof TechnicianFormData, value: string) => {
    onFormDataChange({ ...formData, [field]: value })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-name`}>Name *</Label>
            <Input
              id={`${mode}-name`}
              value={formData.technician_name}
              onChange={(e) => updateField('technician_name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-phone`}>Contact Number *</Label>
            <Input
              id={`${mode}-phone`}
              value={formData.contact_number}
              onChange={(e) => updateField('contact_number', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-email`}>
              {isCreate ? 'Email *' : 'Email'}
            </Label>
            <Input
              id={`${mode}-email`}
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              required={isCreate}
            />
          </div>
          {isCreate && (
            <div className="space-y-2">
              <Label htmlFor="create-password">Password *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Teknisi login pakai email & password ini di aplikasi teknisi.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${mode}-company`}>Company</Label>
            <Input
              id={`${mode}-company`}
              value={formData.company}
              onChange={(e) => updateField('company', e.target.value)}
              placeholder="e.g., CoolAir, ACindo"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
