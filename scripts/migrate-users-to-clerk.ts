// scripts/migrate-users-to-clerk.ts
// Run: bunx tsx scripts/migrate-users-to-clerk.ts
//
// Migrates users from Supabase Auth to Clerk:
// 1. Lists all users from Supabase Auth via supabase.auth.admin.listUsers()
// 2. For each user, creates in Clerk via clerkClient.users.createUser({ emailAddress, skipPasswordRequirement: true })
// 3. Updates user_management.auth_user_id from Supabase UUID to Clerk user ID
// 4. Users receive "set password" email from Clerk
//
// Usage: Run against staging/test first. Do NOT run against production without confirmation.

import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  
  // List all Supabase Auth users
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) { console.error('Failed to list users:', error); process.exit(1) }
  
  console.log(`Found ${users.length} users to migrate`)
  
  for (const user of users) {
    if (!user.email) { console.log(`Skip ${user.id}: no email`); continue }
    
    try {
      // Create in Clerk
      const clerk = await clerkClient()
      const email = user.email.endsWith('.local') 
        ? user.email.replace('.local', '.com')
        : user.email
      const username = email.split('@')[0]
      const clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        username,
        skipPasswordRequirement: true,
      })

      // Update user_management.auth_user_id
      const { error: updateError } = await supabase
        .from('user_management')
        .update({ auth_user_id: clerkUser.id })
        .eq('auth_user_id', user.id)
      
      if (updateError) {
        console.error(`Failed to update user_management for ${user.email}:`, updateError)
      } else {
        console.log(`Migrated ${user.email}: ${user.id} → ${clerkUser.id}`)
      }
    } catch (e) {
      console.error(`Failed to migrate ${user.email}:`, e)
    }
  }
  
  console.log('Migration complete')
}

main().catch(console.error)
