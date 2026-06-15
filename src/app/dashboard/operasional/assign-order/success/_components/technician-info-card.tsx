'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Phone, Mail, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { formatPhone } from '@/lib/utils'

interface TechnicianInfoCardProps {
  technicianData: { data?: { technician_name: string; company?: string; contact_number?: string; email?: string } | null } | undefined
  scheduledDate: string
  helpers: Array<{ technician_id: string; technician_name: string; contact_number?: string }>
}

export function TechnicianInfoCard({ technicianData, scheduledDate, helpers }: TechnicianInfoCardProps) {
  return (
    <Card className='mb-6'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><User className='w-5 h-5' />Assigned Technician</CardTitle>
      </CardHeader>
      <CardContent>
        {technicianData?.data ? (
          <div className='space-y-3'>
            <div><span className='text-sm font-semibold text-muted-foreground'>Name: </span><span className='text-lg font-bold'>{technicianData.data.technician_name}</span></div>
            {technicianData.data.company && <div><span className='text-sm font-semibold text-muted-foreground'>Company: </span><span>{technicianData.data.company}</span></div>}
            <div className='flex gap-4'>
              {technicianData.data.contact_number && <div className='flex items-center gap-2'><Phone className='w-4 h-4 text-muted-foreground' /><span className='text-sm'>{formatPhone(technicianData.data.contact_number)}</span></div>}
              {technicianData.data.email && <div className='flex items-center gap-2'><Mail className='w-4 h-4 text-muted-foreground' /><span className='text-sm'>{technicianData.data.email}</span></div>}
            </div>
            <div className='flex items-center gap-2 pt-2'>
              <Calendar className='w-4 h-4 text-muted-foreground' />
              <span className='text-sm font-semibold text-muted-foreground'>Scheduled Visit Date: </span>
              <span className='text-sm font-bold'>{scheduledDate ? format(new Date(scheduledDate), 'EEEE, dd MMMM yyyy') : '-'}</span>
            </div>
            {helpers.length > 0 && (
              <div className='pt-3 border-t'>
                <div className='text-sm font-semibold text-muted-foreground mb-2'>Helper Technicians ({helpers.length}):</div>
                <div className='space-y-2'>
                  {helpers.map((helper) => (
                    <div key={helper.technician_id} className='flex items-center justify-between p-2 bg-muted/50 rounded-lg'>
                      <div>
                        <div className='font-medium'>{helper.technician_name}</div>
                        {!!helper.contact_number && <div className='flex items-center gap-2 text-xs text-muted-foreground mt-0.5'><Phone className='w-3 h-3' />{formatPhone(helper.contact_number)}</div>}
                      </div>
                      <Badge variant='outline' className='bg-status-assigned-bg text-info border-info/30'>Helper</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : <p className='text-sm text-muted-foreground'>Loading technician info...</p>}
      </CardContent>
    </Card>
  )
}
