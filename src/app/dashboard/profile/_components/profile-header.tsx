'use client'

import { Camera, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ProfileHeaderProps {
  profile: { full_name: string | null; email: string; photo_url: string | null }
  isUploadingPhoto: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onPhotoClick: () => void
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function getInitials(name: string | null): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProfileHeader({
  profile,
  isUploadingPhoto,
  fileInputRef,
  onPhotoClick,
  onPhotoChange,
}: ProfileHeaderProps) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Update your profile picture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.photo_url || undefined} alt={profile.full_name || 'User'} />
                <AvatarFallback className="text-2xl">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              {isUploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPhotoChange}
                className="hidden"
              />
              <Button
                onClick={onPhotoClick}
                disabled={isUploadingPhoto}
                variant="outline"
              >
                <Camera className="w-4 h-4 mr-2" />
                {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
