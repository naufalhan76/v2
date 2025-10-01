'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClipboardList, Search, UserPlus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AssignOrderPage() {
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 md:h-6 md:w-6" />
        <h1 className="text-2xl md:text-3xl font-bold">Assign Order</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Order Belum Ditugaskan</CardTitle>
          <CardDescription>
            Tugaskan teknisi untuk order yang belum memiliki teknisi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari order..." className="max-w-full md:max-w-sm" />
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Order ID</TableHead>
                  <TableHead className="min-w-[150px]">Pelanggan</TableHead>
                  <TableHead className="min-w-[120px]">Jenis Service</TableHead>
                  <TableHead className="min-w-[150px]">Lokasi</TableHead>
                  <TableHead className="min-w-[100px]">Tanggal</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="text-right min-w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Tidak ada order yang perlu ditugaskan saat ini.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            <Card className="p-4">
              <div className="text-center text-muted-foreground py-8">
                Tidak ada order yang perlu ditugaskan saat ini.
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
