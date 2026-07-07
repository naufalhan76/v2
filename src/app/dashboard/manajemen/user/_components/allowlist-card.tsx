'use client'

import { useState } from 'react'
import { ShieldCheck, Plus, X, Mail, Globe, Ban, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAllowlist } from '@/hooks/use-allowlist'

export function AllowlistCard() {
  const {
    emails, domains, blocked, isLoading,
    activeTab, setActiveTab,
    newEmail, setNewEmail, newDomain, setNewDomain,
    isSubmitting,
    handleAddEmail, handleRemoveEmail,
    handleAddDomain, handleRemoveDomain,
  } = useAllowlist()

  const tabs = [
    { key: 'emails' as const, label: 'Emails', icon: Mail, count: emails.length },
    { key: 'domains' as const, label: 'Domains', icon: Globe, count: domains.length },
    { key: 'blocked' as const, label: 'Blocked', icon: Ban, count: blocked.length },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">Auth Guard — Allowlist</CardTitle>
            <CardDescription>
              Hanya email/domain di bawah ini yang bisa mendaftar. Sign-up lainnya otomatis diblokir.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-muted'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{tab.count}</Badge>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Emails Tab */}
            {activeTab === 'emails' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddEmail} disabled={isSubmitting || !newEmail.trim()} size="sm">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {emails.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada email yang di-allowlist
                    </p>
                  ) : (
                    emails.map((item) => (
                      <div
                        key={item.email}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-surface-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{item.email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveEmail(item.email)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Domains Tab */}
            {activeTab === 'domains' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddDomain} disabled={isSubmitting || !newDomain.trim()} size="sm">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Semua email dengan domain ini akan otomatis di-allowlist (e.g. <code>@example.com</code>)
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {domains.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada domain yang di-allowlist
                    </p>
                  ) : (
                    domains.map((item) => (
                      <div
                        key={item.domain}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-surface-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">@{item.domain}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveDomain(item.domain)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Blocked Tab */}
            {activeTab === 'blocked' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {blocked.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Tidak ada upaya sign-up yang diblokir
                  </p>
                ) : (
                  blocked.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
                          <span className="text-sm font-medium truncate">{item.email}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 ml-5">{item.reason}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {new Date(item.blocked_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
