'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { History, Search, Download, Filter } from 'lucide-react'
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

export default function MonitoringHistoryPage() {
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 md:h-6 md:w-6" />
          <h1 className="text-2xl md:text-3xl font-bold">Monitoring History</h1>
        </div>
        <Button variant="outline" className="w-full md:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Order</CardTitle>
          <CardDescription>
            Lihat riwayat order yang telah selesai atau dibatalkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col md:flex-row items-start md:items-center gap-2">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari order..." className="w-full md:max-w-sm" />
            </div>
            <Select>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">Minggu Ini</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
                <SelectItem value="all">Semua</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Order ID</TableHead>
                  <TableHead className="min-w-[150px]">Pelanggan</TableHead>
                  <TableHead className="min-w-[150px]">Teknisi</TableHead>
                  <TableHead className="min-w-[120px]">Jenis Service</TableHead>
                  <TableHead className="min-w-[100px]">Tanggal</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Total</TableHead>
                  <TableHead className="text-right min-w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Tidak ada riwayat order.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            <Card className="p-4">
              <div className="text-center text-muted-foreground py-8">
                Tidak ada riwayat order.
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
