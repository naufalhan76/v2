'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  getUserApiKeys,
  createApiKey,
  regenerateApiKey,
  deleteApiKey,
  type ApiKeyInfo,
  type ApiKeyWithSecret,
} from '@/lib/actions/api-keys'
import { logger } from '@/lib/logger'
import { ApiKeyCreateDialog } from './api-keys/api-key-create-dialog'
import { ApiKeyConfirmDialogs } from './api-keys/api-key-confirm-dialogs'
import { ApiKeysTable } from './api-keys/api-keys-table'
import { ApiKeyUsageCard } from './api-keys/api-key-usage-card'

export function ApiKeysManagement() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [_showCopiedNotification, setShowCopiedNotification] = useState(false)
  const [newKeyData, setNewKeyData] = useState<ApiKeyWithSecret | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyDescription, setNewKeyDescription] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  const { toast } = useToast()

  // Load API keys on mount
  useEffect(() => {
    loadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadKeys() {
    try {
      setIsLoading(true)
      const result = await getUserApiKeys()
      if (result.success) {
        setKeys(result.keys)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load API keys',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error loading API keys:', error)
      toast({
        title: 'Error',
        description: 'Failed to load API keys',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSaving(true)
      const result = await createApiKey(newKeyName, newKeyDescription || undefined, 90)
      if (result.success && result.data) {
        setNewKeyData(result.data)
        setNewKeyName('')
        setNewKeyDescription('')
        await loadKeys()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error creating API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRegenerateKey() {
    if (!selectedKeyId) return

    try {
      setIsSaving(true)
      const result = await regenerateApiKey(selectedKeyId)
      if (result.success && result.data) {
        setNewKeyData({
          ...result.data,
          api_key: 'sk_live_' + Math.random().toString(36).substring(2, 34), // Placeholder
          warning: result.data.warning || 'Old API key is now invalid. Save this new key in a secure location!',
        })
        setShowRegenerateDialog(false)
        await loadKeys()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to regenerate API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error regenerating API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to regenerate API key',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteKey() {
    if (!selectedKeyId) return

    try {
      setIsSaving(true)
      const result = await deleteApiKey(selectedKeyId)
      if (result.success) {
        toast({
          title: 'Success',
          description: 'API key deleted successfully',
        })
        setShowDeleteDialog(false)
        await loadKeys()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Error deleting API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setShowCopiedNotification(true)
    setTimeout(() => setShowCopiedNotification(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Create and manage API keys for programmatic access to the API. Each key can be regenerated or revoked individually.
        </p>
      </div>

      <ApiKeysTable
        keys={keys}
        isLoading={isLoading}
        isSaving={isSaving}
        onCreate={() => setShowNewKeyDialog(true)}
        onRegenerate={(keyId) => { setSelectedKeyId(keyId); setShowRegenerateDialog(true) }}
        onDelete={(keyId) => { setSelectedKeyId(keyId); setShowDeleteDialog(true) }}
      />

      <ApiKeyUsageCard />

      <ApiKeyCreateDialog
        open={showNewKeyDialog}
        onOpenChange={setShowNewKeyDialog}
        newKeyData={newKeyData}
        newKeyName={newKeyName}
        newKeyDescription={newKeyDescription}
        showApiKey={showApiKey}
        isSaving={isSaving}
        onNameChange={setNewKeyName}
        onDescriptionChange={setNewKeyDescription}
        onShowApiKeyChange={setShowApiKey}
        onCreate={handleCreateKey}
        onCopy={copyToClipboard}
        onDone={() => { setShowNewKeyDialog(false); setNewKeyData(null); setShowApiKey(false) }}
      />

      <ApiKeyConfirmDialogs
        showRegenerateDialog={showRegenerateDialog}
        showDeleteDialog={showDeleteDialog}
        isSaving={isSaving}
        onRegenerateOpenChange={setShowRegenerateDialog}
        onDeleteOpenChange={setShowDeleteDialog}
        onRegenerate={handleRegenerateKey}
        onDelete={handleDeleteKey}
      />
    </div>
  )
}
