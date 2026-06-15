'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Mail, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface UserProfile {
  user_id: string
  email: string
  full_name: string | null
  photo_url: string | null
  role: string
}

interface ProfileFormProps {
  profile: UserProfile
  initialFullName: string
  initialEmail: string
  isSaving: boolean
  onSave: (fullName: string, email: string) => void
}

export function ProfileForm({
  profile,
  initialFullName,
  initialEmail,
  isSaving,
  onSave,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName)
  const [email, setEmail] = useState(initialEmail)
  const [showEmailDialog, setShowEmailDialog] = useState(false)

  const handleSave = () => {
    if (email !== profile.email) {
      setShowEmailDialog(true)
      return
    }
    onSave(fullName, email)
  }

  const handleConfirmEmailChange = () => {
    setShowEmailDialog(false)
    onSave(fullName, email)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="pl-10"
              />
            </div>
            {email !== profile.email && (
              <p className="flex items-center gap-1.5 text-sm text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Changing your email will require verification
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={profile.role} disabled className="bg-muted" />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Email Change</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change your email from <strong>{profile.email}</strong> to{' '}
              <strong>{email}</strong>.
              <br />
              <br />
              A verification email will be sent to your new email address. You will need to verify
              your new email before the change takes effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEmailChange}>
              Confirm & Send Verification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
