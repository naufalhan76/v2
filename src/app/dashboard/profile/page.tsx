'use client'

import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Separator } from '@/components/ui/separator'
import { getUserProfile, updateUserProfile, updateUserPassword, updateProfilePhoto } from '@/lib/actions/profile'
import { ApiKeysManagement } from '@/components/api-keys-management'
import { ProfileHeader } from './_components/profile-header'
import { ProfileForm } from './_components/profile-form'
import { PasswordChangeForm } from './_components/password-change-form'

interface UserProfile {
  user_id: string
  email: string
  full_name: string | null
  photo_url: string | null
  role: string
}

const LoadingSkeleton = () => (
  <div className="min-h-screen bg-background p-6">
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded bg-muted animate-pulse" />
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3 w-64 rounded bg-muted animate-pulse" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded bg-muted animate-pulse" />
          </div>
        ))}
        <div className="h-10 w-32 rounded bg-muted animate-pulse" />
      </div>
    </div>
  </div>
)

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => { fetchProfile(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const fetchProfile = async () => {
    setIsLoading(true)
    try {
      const result = await getUserProfile()
      if (result.success && result.data) {
        setProfile(result.data)
        setFullName(result.data.full_name || '')
        setEmail(result.data.email)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to load profile', variant: 'destructive' })
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    } finally { setIsLoading(false) }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please upload an image file', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image smaller than 5MB', variant: 'destructive' })
      return
    }
    setIsUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await updateProfilePhoto(formData)
      if (result.success) {
        toast({ title: 'Success', description: 'Profile photo updated successfully' })
        fetchProfile()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to upload photo', variant: 'destructive' })
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    } finally { setIsUploadingPhoto(false) }
  }

  const handleSaveProfile = async (newFullName: string, newEmail: string) => {
    setIsSavingProfile(true)
    try {
      const result = await updateUserProfile({ full_name: newFullName, email: newEmail })
      if (result.success) {
        toast({ title: 'Success', description: result.message || 'Profile updated successfully' })
        fetchProfile()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update profile', variant: 'destructive' })
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    } finally { setIsSavingProfile(false) }
  }

  const handleSavePassword = async (currentPassword: string, newPassword: string) => {
    setIsSavingPassword(true)
    try {
      const result = await updateUserPassword(currentPassword, newPassword)
      if (result.success) {
        toast({ title: 'Success', description: 'Password updated successfully' })
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update password', variant: 'destructive' })
      }
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : String(error), variant: 'destructive' })
    } finally { setIsSavingPassword(false) }
  }

  if (isLoading) return <LoadingSkeleton />
  if (!profile) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Profile not found</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <ProfileHeader
          profile={profile}
          isUploadingPhoto={isUploadingPhoto}
          fileInputRef={fileInputRef}
          onPhotoClick={() => fileInputRef.current?.click()}
          onPhotoChange={handlePhotoChange}
        />
        <ProfileForm
          profile={profile}
          initialFullName={fullName}
          initialEmail={email}
          isSaving={isSavingProfile}
          onSave={handleSaveProfile}
        />
        <PasswordChangeForm
          isSaving={isSavingPassword}
          onSave={handleSavePassword}
        />
      </div>
      <div className="max-w-2xl mx-auto mt-8">
        <Separator className="my-8" />
        <ApiKeysManagement />
      </div>
    </div>
  )
}
