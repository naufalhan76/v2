'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Briefcase, UserCog, MessageCircle, Plug } from 'lucide-react'

import { BusinessFlowTab } from './_components/business-flow-tab'
import { AccountFlowTab } from './_components/account-flow-tab'
import { OpenwaSetupTab } from './_components/openwa-setup-tab'
import { OpenwaIntegrationTab } from './_components/openwa-integration-tab'

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <BookOpen className="h-6 w-6 text-muted-foreground mt-1" />
              <div>
                <CardTitle>Panduan Pengguna</CardTitle>
                <CardDescription>
                  Dokumentasi alur bisnis, manajemen akun, dan integrasi WhatsApp.
                  Halaman ini untuk admin dan finance — teknisi tidak perlu.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="business" className="space-y-4">
          <TabsList>
            <TabsTrigger value="business" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Alur Bisnis
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <UserCog className="h-4 w-4" />
              Akun User
            </TabsTrigger>
            <TabsTrigger value="openwa-setup" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Setup OpenWA
            </TabsTrigger>
            <TabsTrigger value="openwa-integration" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrasi OpenWA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <BusinessFlowTab />
          </TabsContent>
          <TabsContent value="account">
            <AccountFlowTab />
          </TabsContent>
          <TabsContent value="openwa-setup">
            <OpenwaSetupTab />
          </TabsContent>
          <TabsContent value="openwa-integration">
            <OpenwaIntegrationTab />
          </TabsContent>
        </Tabs>
      </div>
    </Suspense>
  )
}
