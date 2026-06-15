import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { AddonRequest } from '@/lib/actions/addon-requests'
import { formatCurrency, getCategoryColor, getCategoryLabel } from './addons-table'

interface AddonRequestTableProps {
  requests: AddonRequest[]
  onOpenApprove: (request: AddonRequest) => void
  onOpenReject: (request: AddonRequest) => void
}

export function AddonRequestTable({
  requests,
  onOpenApprove,
  onOpenReject,
}: AddonRequestTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm bg-card">
      <Table>
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0">
            <TableHead>Teknisi</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Nama Part</TableHead>
            <TableHead>Harga Usulan</TableHead>
            <TableHead>Satuan</TableHead>
            <TableHead className="hidden md:table-cell">Deskripsi</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req) => (
            <TableRow key={req.request_id} className="border-0 hover:bg-muted/50">
              <TableCell className="font-medium">
                {req.technicians?.technician_name || req.requested_by_technician_id}
              </TableCell>
              <TableCell>
                <Badge className={getCategoryColor(req.category)}>
                  {getCategoryLabel(req.category)}
                </Badge>
              </TableCell>
              <TableCell>{req.item_name}</TableCell>
              <TableCell>
                {req.proposed_unit_price != null
                  ? formatCurrency(req.proposed_unit_price)
                  : '-'}
              </TableCell>
              <TableCell>{req.unit_of_measure || '-'}</TableCell>
              <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                {req.description || '-'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenApprove(req)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 text-success border-success/30 hover:bg-status-completed-bg hover:text-success"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenReject(req)}
                    className="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4" />
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
