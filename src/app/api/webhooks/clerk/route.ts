import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const log = logger.child('webhook:clerk')

/**
 * POST /api/webhooks/clerk
 *
 * Clerk webhook handler — listens for `user.created` events and checks
 * if the new user's email is in the allowlist (allowed_emails or allowed_domains).
 * If NOT allowed, the user is immediately deleted from Clerk and the attempt
 * is logged to blocked_signups.
 *
 * Security: Svix signature verification via CLERK_WEBHOOK_SECRET env var.
 * The webhook endpoint is public (no Clerk auth) but protected by Svix.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    log.error('CLERK_WEBHOOK_SECRET not set — webhook cannot verify')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify Svix signature
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    log.warn('Missing Svix headers — rejecting webhook')
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 })
  }

  const payload = await request.text()
  const wh = new Webhook(webhookSecret)

  let evt: ClerkWebhookEvent
  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch (err) {
    log.error('Svix verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only handle user.created
  if (evt.type !== 'user.created') {
    return NextResponse.json({ received: true, type: evt.type })
  }

  const clerkUserId = evt.data.id
  const primaryEmail = evt.data.email_addresses?.find(
    (e) => e.id === evt.data.primary_email_address_id,
  )?.email_address

  if (!primaryEmail) {
    log.warn(`user.created for ${clerkUserId} but no primary email — allowing (manual review needed)`)
    return NextResponse.json({ received: true, action: 'no_email' })
  }

  const normalizedEmail = primaryEmail.toLowerCase().trim()
  log.info(`user.created: ${clerkUserId} email=${normalizedEmail}`)

  // Check allowlist
  const supabase = await createClient()
  const { data: allowed } = await supabase.rpc('is_email_allowed', { check_email: normalizedEmail })

  if (allowed === true) {
    log.info(`Allowlist match for ${normalizedEmail} — user permitted`)

    // Auto-insert into user_management with default role TECHNICIAN
    // so middleware doesn't block them. Admin can upgrade role later.
    const fullName = `${evt.data.first_name || ''} ${evt.data.last_name || ''}`.trim()
      || normalizedEmail.split('@')[0]

    const { error: insertErr } = await supabase
      .from('user_management')
      .insert({
        auth_user_id: clerkUserId,
        email: normalizedEmail,
        full_name: fullName,
        role: 'TECHNICIAN',
        is_active: true,
      })

    if (insertErr) {
      // If already exists (duplicate), that's fine — skip
      if (insertErr.code !== '23505') {
        log.error(`Failed to insert user_management for ${normalizedEmail}:`, insertErr)
      }
    } else {
      log.info(`Auto-inserted ${normalizedEmail} into user_management as TECHNICIAN`)
    }

    // Auto-create technician record so /api/technician/* routes work immediately
    const { error: techInsertErr } = await supabase
      .from('technicians')
      .insert({
        technician_name: fullName,
        email: normalizedEmail,
        auth_user_id: clerkUserId,
      })

    if (techInsertErr) {
      if (techInsertErr.code !== '23505') {
        log.error(`Failed to insert technicians record for ${normalizedEmail}:`, techInsertErr)
      }
    } else {
      log.info(`Auto-created technician record for ${normalizedEmail}`)
    }

    return NextResponse.json({ received: true, action: 'allowed' })
  }

  // NOT allowed — delete user from Clerk + log blocked attempt
  log.warn(`BLOCKING sign-up: ${normalizedEmail} not in allowlist`)

  try {
    const client = await clerkClient()
    await client.users.deleteUser(clerkUserId)
    log.info(`Deleted unauthorized Clerk user: ${clerkUserId}`)
  } catch (err) {
    log.error(`Failed to delete Clerk user ${clerkUserId}:`, err)
    // Still log the blocked attempt
  }

  // Log to blocked_signups
  const domain = normalizedEmail.split('@')[1] || ''
  await supabase.from('blocked_signups').insert({
    email: normalizedEmail,
    clerk_user_id: clerkUserId,
    reason: `email not in allowlist (domain: ${domain})`,
  })

  return NextResponse.json({ received: true, action: 'blocked' })
}

// Clerk webhook event types (minimal — only what we need)
type ClerkWebhookEvent = {
  type: string
  data: {
    id: string
    email_addresses: Array<{
      id: string
      email_address: string
    }>
    primary_email_address_id: string | null
    first_name: string | null
    last_name: string | null
  }
}
