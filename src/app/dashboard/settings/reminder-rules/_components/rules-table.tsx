'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Bell, Mail, MessageCircle, Pencil, Plus, Power } from 'lucide-react'
import type { ReminderRule } from '@/lib/reminder-utils'

interface RulesTableProps {
  rules: ReminderRule[]
  isFetching: boolean
  onEdit: (rule: ReminderRule) => void
  onDelete: (rule: ReminderRule) => void
  onAdd: () => void
}

function ChannelBadge({ channel }: { channel: ReminderRule['channel'] }) {
  if (channel === 'WHATSAPP') {
    return (
      <Badge variant="secondary" className="gap-1">
        <MessageCircle className="h-3 w-3" />
        WhatsApp
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Mail className="h-3 w-3" />
      Email
    </Badge>
  )
}

export function RulesTable({
  rules,
  isFetching,
  onEdit,
  onDelete,
  onAdd,
}: RulesTableProps) {
  if (isFetching) {
    return <TableSkeleton rows={5} columns={6} />
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Belum ada reminder rule"
        description="Tambahkan rule pertama untuk mulai mengirim pengingat service ke customer."
        action={{
          label: 'Tambah Rule',
          icon: Plus,
          onClick: onAdd,
        }}
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm bg-card">
      <Table>
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0">
            <TableHead>Nama</TableHead>
            <TableHead className="hidden md:table-cell">Hari Sebelum</TableHead>
            <TableHead className="hidden sm:table-cell">Channel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Auto Send</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow
              key={rule.rule_id}
              className="border-0 hover:bg-muted/50"
            >
              <TableCell className="font-medium">
                <div>{rule.name}</div>
                <div className="text-xs text-muted-foreground md:hidden mt-1">
                  {rule.days_before_due} hari sebelum
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {rule.days_before_due} hari
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <ChannelBadge channel={rule.channel} />
              </TableCell>
              <TableCell>
                {rule.is_active ? (
                  <Badge className="bg-success hover:bg-success/90">
                    Aktif
                  </Badge>
                ) : (
                  <Badge variant="secondary">Nonaktif</Badge>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {rule.auto_send ? (
                  <Badge
                    variant="outline"
                    className="border-info/50 text-info dark:text-info"
                  >
                    Otomatis
                  </Badge>
                ) : (
                  <Badge variant="outline">Manual</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Edit"
                    onClick={() => onEdit(rule)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Nonaktifkan"
                    onClick={() => onDelete(rule)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9"
                  >
                    <Power className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
