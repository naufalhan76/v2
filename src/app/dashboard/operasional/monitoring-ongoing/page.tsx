'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Monitor, Search, Eye } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function MonitoringOngoingPage() {
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 md:h-6 md:w-6" />
        <h1 className="text-2xl md:text-3xl font-bold">Monitoring Ongoing</h1>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="in-progress">Proses</TabsTrigger>
          <TabsTrigger value="on-the-way">Perjalanan</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Sedang Berjalan</CardTitle>
              <CardDescription>
                Pantau progress order yang sedang dikerjakan teknisi
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
                      <TableHead className="min-w-[150px]">Teknisi</TableHead>
                      <TableHead className="min-w-[120px]">Jenis Service</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[100px]">Progress</TableHead>
                      <TableHead className="text-right min-w-[120px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Tidak ada order yang sedang berjalan saat ini.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                <Card className="p-4">
                  <div className="text-center text-muted-foreground py-8">
                    Tidak ada order yang sedang berjalan saat ini.
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Dalam Proses</CardTitle>
              <CardDescription>
                Order yang sedang dikerjakan oleh teknisi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari order..." className="max-w-sm" />
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Teknisi</TableHead>
                      <TableHead>Jenis Service</TableHead>
                      <TableHead>Waktu Mulai</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Tidak ada order dalam proses.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="on-the-way" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teknisi Dalam Perjalanan</CardTitle>
              <CardDescription>
                Teknisi yang sedang dalam perjalanan menuju lokasi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari order..." className="max-w-sm" />
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Teknisi</TableHead>
                      <TableHead>Estimasi Tiba</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Tidak ada teknisi dalam perjalanan.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
