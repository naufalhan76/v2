'use client'

import { useState } from 'react'
import { Eye, EyeOff, Copy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useEffect } from 'react'
import { generateNewApiKey } from '@/lib/actions/api-keys'

const API_KEY_STORAGE_KEY = 'webpanel_api_key'

export function ApiKeyDisplay() {
  const { toast } = useToast()
  const [isVisible, setIsVisible] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load API key from localStorage on mount
  useEffect(() => {
    const initApiKey = async () => {
      try {
        // Get existing API key from localStorage
        const storedKey = typeof window !== 'undefined' ? localStorage.getItem(API_KEY_STORAGE_KEY) : null
        
        if (storedKey) {
          setApiKey(storedKey)
        }
        // Don't auto-generate - let user click a button to generate/reset
      } catch (error) {
        console.error('Error loading API key:', error)
      } finally {
        setIsInitialized(true)
      }
    }
    initApiKey()
  }, [])

  const handleCopyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setIsCopied(true)
      toast({
        title: 'Copied to clipboard',
        duration: 2000,
      })
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleResetKey = async () => {
    setIsLoading(true)
    try {
      const result = await generateNewApiKey()
      if (result.success && result.apiKey) {
        setApiKey(result.apiKey)
        // Update localStorage with new key
        if (typeof window !== 'undefined') {
          localStorage.setItem(API_KEY_STORAGE_KEY, result.apiKey)
        }
        toast({
          title: 'API key reset successfully',
          description: 'Your new API key is ready to use',
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to reset API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset API key',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setShowResetDialog(false)
    }
  }

  const handleGenerateKey = async () => {
    setIsLoading(true)
    try {
      const result = await generateNewApiKey()
      if (result.success && result.apiKey) {
        setApiKey(result.apiKey)
        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(API_KEY_STORAGE_KEY, result.apiKey)
        }
        toast({
          title: 'API key generated successfully',
          description: 'Keep this key safe and secret!',
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to generate API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate API key',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isInitialized) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your API Key</CardTitle>
          <CardDescription>Use this key to authenticate API requests. Keep it secret!</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-10 bg-slate-950 rounded-lg">
            <span className="text-slate-400 text-sm">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!apiKey) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your API Key</CardTitle>
          <CardDescription>Generate an API key to authenticate API requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGenerateKey}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Generating...' : 'Generate API Key'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your API Key</CardTitle>
          <CardDescription>Use this key to authenticate API requests. Keep it secret!</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Key Display Box */}
            <div className="flex items-center gap-3 bg-slate-950 rounded-lg p-3 border border-slate-800">
              <code className="flex-1 text-sm font-mono text-slate-300 break-all">
                {isVisible ? apiKey : apiKey.replace(/./g, '•')}
              </code>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsVisible(!isVisible)}
                  className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  title={isVisible ? 'Hide' : 'Show'}
                >
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyKey}
                  className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowResetDialog(true)}
                  disabled={isLoading}
                  className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  title="Reset API key"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="text-xs text-slate-500 space-y-1">
              <p>This key is safe to use in a browser if you have enabled Row Level Security for your tables and configured policies.</p>
              <p>Prefer using <a href="#" className="text-blue-500 hover:underline">Publishable API keys</a> instead.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new API key. Your old key will no longer work for authentication. Make sure to update any applications using the old key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetKey}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? 'Resetting...' : 'Reset Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
