'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { ChevronLeft, User } from 'lucide-react'
import { cn, formatPhone } from '@/lib/utils'

interface TechnicianSelectorProps {
  technicians: unknown[]
  selectedOrdersCount: number
  selectedTechnician: string
  selectedHelpers: string[]
  onTechnicianChange: (techId: string) => void
  onHelpersChange: (helperIds: string[]) => void
  onBack: () => void
  onConfirm: () => void
}

export function TechnicianSelector({
  technicians,
  selectedOrdersCount,
  selectedTechnician,
  selectedHelpers,
  onTechnicianChange,
  onHelpersChange,
  onBack,
  onConfirm,
}: TechnicianSelectorProps) {
  const [technicianSearch, setTechnicianSearch] = useState<string>('')

  const filteredTechnicians = technicians.filter((tech: unknown) => {
    const t = tech as Record<string, unknown>
    if (!technicianSearch) return true
    const searchLower = technicianSearch.toLowerCase()
    return (
      (t.technician_name as string)?.toLowerCase().includes(searchLower) ||
      (t.company as string)?.toLowerCase().includes(searchLower) ||
      (t.contact_number as string)?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <Card>
      <CardContent className='pt-6'>
        <h2 className='text-xl font-semibold mb-1'>Step 3: Select Technician</h2>
        <p className='text-sm text-muted-foreground mb-4'>
          Choose a lead technician and optional helpers to assign {selectedOrdersCount} order(s)
        </p>

        {/* Search Bar */}
        <div className='mb-4 relative'>
          <User className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search technician by name, company, or contact...'
            value={technicianSearch}
            onChange={(e) => setTechnicianSearch(e.target.value)}
            className='pl-9'
          />
        </div>

        {filteredTechnicians.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            {technicianSearch ? 'No technicians found matching your search' : 'No technicians available'}
          </div>
        ) : (
          <div className='space-y-6'>
            {/* Lead Technician Selection */}
            <div>
              <h3 className='font-semibold mb-3'>Lead Technician <span className='text-destructive'>*</span></h3>
              <RadioGroup value={selectedTechnician} onValueChange={onTechnicianChange}>
                <div className='grid gap-4 max-h-[300px] overflow-y-auto pr-2'>
                  {filteredTechnicians.map((technician: unknown) => {
                    const tech = technician as Record<string, unknown> & {
                      technician_id: string
                      technician_name: string
                      company?: string
                      contact_number?: string
                    }
                    return (
                      <div
                        key={tech.technician_id}
                        className={cn(
                          'flex items-center space-x-4 rounded-lg p-4 cursor-pointer transition-all',
                          selectedTechnician === tech.technician_id
                            ? 'border-2 border-primary bg-muted'
                            : 'border border-border hover:bg-muted/50'
                        )}
                        onClick={() => onTechnicianChange(tech.technician_id)}
                      >
                        <RadioGroupItem value={tech.technician_id} id={tech.technician_id} />
                        <Label htmlFor={tech.technician_id} className='flex-1 cursor-pointer'>
                          <div className='flex items-center justify-between'>
                            <div>
                              <div className='font-semibold'>{tech.technician_name}</div>
                              {tech.company && (
                                <div className='text-sm text-muted-foreground'>{tech.company}</div>
                              )}
                              {tech.contact_number && (
                                <div className='text-sm text-muted-foreground'>
                                  {formatPhone(tech.contact_number as string | number | null | undefined)}
                                </div>
                              )}
                            </div>
                            <User className='h-8 w-8 text-muted-foreground' />
                          </div>
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </RadioGroup>
            </div>

            {/* Helper Technicians Selection */}
            {selectedTechnician && (
              <div>
                <h3 className='font-semibold mb-3'>
                  Helper Technicians <span className='text-muted-foreground text-sm font-normal'>(Optional)</span>
                </h3>
                <MultiSelectDropdown
                  options={filteredTechnicians.flatMap((tech: unknown) => {
                    const t = tech as Record<string, unknown> & {
                      technician_id: string
                      technician_name: string
                      company?: string
                      contact_number?: string
                    }
                    if (t.technician_id === selectedTechnician) return []
                    return [{
                      id: t.technician_id,
                      label: t.technician_name,
                      secondaryLabel: t.company || formatPhone(t.contact_number)
                    }]
                  })}
                  selected={selectedHelpers}
                  onSelectionChange={onHelpersChange}
                  placeholder='Select helper technicians...'
                  searchPlaceholder='Search technicians...'
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
      <div className='p-6 pt-0 flex justify-between'>
        <Button variant='outline' onClick={onBack}>
          <ChevronLeft className='mr-2 h-4 w-4' /> Back
        </Button>
        <Button onClick={onConfirm} disabled={!selectedTechnician}>
          Confirm Assignment
        </Button>
      </div>
    </Card>
  )
}
