import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Mail, Send } from 'lucide-react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

interface CommunicationStatsBannerProps {
  stats: { totalSent: number; emailSent: number; whatsappSent: number; lastSentAt: string | null; lastSentType: string | null }
}

export function CommunicationStatsBanner({ stats }: CommunicationStatsBannerProps) {
  if (stats.totalSent === 0) return null
  return (
    <Card className="bg-muted border-border">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Email Sent</p>
                <p className="text-2xl font-bold text-primary">{stats.emailSent}x</p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-12 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">WhatsApp Sent</p>
                <p className="text-2xl font-bold text-success">{stats.whatsappSent}x</p>
              </div>
            </div>
          </div>
          {stats.lastSentAt && (
            <div className="sm:text-right">
              <p className="text-sm text-muted-foreground">Last Sent via {stats.lastSentType}</p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(stats.lastSentAt), "dd MMM yyyy 'at' HH:mm", { locale: localeId })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
