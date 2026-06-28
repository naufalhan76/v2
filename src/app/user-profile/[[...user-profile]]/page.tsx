import { UserProfile } from '@clerk/nextjs'

export default function UserProfilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <UserProfile />
    </div>
  )
}
