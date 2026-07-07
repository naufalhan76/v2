'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  listAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail,
  listAllowedDomains,
  addAllowedDomain,
  removeAllowedDomain,
  listBlockedSignups,
  type AllowedEmail,
  type AllowedDomain,
  type BlockedSignup,
} from '@/lib/actions/allowlist'

export function useAllowlist() {
  const [emails, setEmails] = useState<AllowedEmail[]>([])
  const [domains, setDomains] = useState<AllowedDomain[]>([])
  const [blocked, setBlocked] = useState<BlockedSignup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'emails' | 'domains' | 'blocked'>('emails')

  const [newEmail, setNewEmail] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [e, d, b] = await Promise.all([
      listAllowedEmails(),
      listAllowedDomains(),
      listBlockedSignups(),
    ])
    setEmails(e)
    setDomains(d)
    setBlocked(b)
    setIsLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleAddEmail = async () => {
    if (!newEmail.trim()) return
    setIsSubmitting(true)
    const res = await addAllowedEmail(newEmail)
    setIsSubmitting(false)
    if (res.success) {
      setNewEmail('')
      await load()
    } else {
      alert(res.error)
    }
  }

  const handleRemoveEmail = async (email: string) => {
    await removeAllowedEmail(email)
    await load()
  }

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return
    setIsSubmitting(true)
    const res = await addAllowedDomain(newDomain)
    setIsSubmitting(false)
    if (res.success) {
      setNewDomain('')
      await load()
    } else {
      alert(res.error)
    }
  }

  const handleRemoveDomain = async (domain: string) => {
    await removeAllowedDomain(domain)
    await load()
  }

  return {
    emails, domains, blocked, isLoading,
    activeTab, setActiveTab,
    newEmail, setNewEmail, newDomain, setNewDomain,
    isSubmitting,
    handleAddEmail, handleRemoveEmail,
    handleAddDomain, handleRemoveDomain,
    reload: load,
  }
}
