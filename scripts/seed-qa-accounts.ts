/**
 * Idempotent seeder for the QA E2E suite.
 *
 * Creates four Supabase auth users:
 *   - QA Admin       (role: ADMIN)
 *   - QA Finance     (role: FINANCE)
 *   - QA Tech 1      (role: TECHNICIAN, used as lead)
 *   - QA Tech 2      (role: TECHNICIAN, used as helper)
 *
 * Plus the matching `user_management` rows and `technicians` rows. Existing
 * users are left untouched (matched by email).
 *
 * After running, this script writes/updates `.env.test.local` with the
 * QA_*_EMAIL / QA_*_PASSWORD entries so Playwright can pick them up.
 *
 * Usage: npm run qa:seed
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const raw = readFileSync(path, 'utf-8')
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = {
  ...loadDotEnv(resolve(process.cwd(), '.env.test.local')),
  ...loadDotEnv(resolve(process.cwd(), '.env.staging')),
  ...process.env,
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    '[seed-qa] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  )
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type SeedAccount = {
  envKey: string
  email: string
  password: string
  role: 'ADMIN' | 'FINANCE' | 'TECHNICIAN'
  fullName: string
  /** True when this account also needs a technicians row. */
  technician: boolean
}

const accounts: SeedAccount[] = [
  {
    envKey: 'ADMIN',
    email: 'qa-admin@msn-erp.local',
    password: 'QaAdmin!2026',
    role: 'ADMIN',
    fullName: 'QA Admin',
    technician: false,
  },
  {
    envKey: 'FINANCE',
    email: 'qa-finance@msn-erp.local',
    password: 'QaFinance!2026',
    role: 'FINANCE',
    fullName: 'QA Finance',
    technician: false,
  },
  {
    envKey: 'TECH1',
    email: 'qa-tech1@msn-erp.local',
    password: 'QaTech1!2026',
    role: 'TECHNICIAN',
    fullName: 'QA Tech One',
    technician: true,
  },
  {
    envKey: 'TECH2',
    email: 'qa-tech2@msn-erp.local',
    password: 'QaTech2!2026',
    role: 'TECHNICIAN',
    fullName: 'QA Tech Two',
    technician: true,
  },
]

async function ensureAuthUser(account: SeedAccount): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const found = list?.users.find((u) => u.email === account.email)
  if (found) {
    console.log(`[seed-qa] reusing auth user ${account.email}`)
    return found.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName, qa: true },
  })
  if (error || !data.user) {
    throw new Error(`[seed-qa] createUser failed: ${error?.message}`)
  }
  console.log(`[seed-qa] created auth user ${account.email}`)
  return data.user.id
}

async function ensureUserManagement(
  userId: string,
  account: SeedAccount
): Promise<void> {
  // user_management.user_id is an internal MSN TEXT id (auto-generated).
  // The link to auth.users is auth_user_id (UUID). The app looks users up by
  // auth_user_id, so that MUST be populated.
  const { data: existing } = await admin
    .from('user_management')
    .select('user_id')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (existing) {
    await admin
      .from('user_management')
      .update({ role: account.role, full_name: account.fullName, is_active: true })
      .eq('auth_user_id', userId)
    return
  }
  await admin.from('user_management').insert({
    auth_user_id: userId,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    is_active: true,
  })
}

async function ensureTechnician(
  userId: string,
  account: SeedAccount
): Promise<void> {
  if (!account.technician) return
  const { data: existing } = await admin
    .from('technicians')
    .select('technician_id')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (existing) return
  const { error: techErr } = await admin.from('technicians').insert({
    auth_user_id: userId,
    technician_name: account.fullName,
    contact_number: '+62811000000',
    email: account.email,
  })
  if (techErr) {
    console.error(`[seed-qa] technicians insert FAILED for ${account.email}: ${techErr.message}`)
    process.exitCode = 1
    return
  }
  console.log(`[seed-qa] created technicians row for ${account.email}`)
}

async function main(): Promise<void> {
  for (const acct of accounts) {
    const userId = await ensureAuthUser(acct)
    await ensureUserManagement(userId, acct)
    await ensureTechnician(userId, acct)
  }

  // Append/update .env.test.local
  const envPath = resolve(process.cwd(), '.env.test.local')
  const existing = loadDotEnv(envPath)
  const merged: Record<string, string> = { ...existing }
  for (const acct of accounts) {
    merged[`QA_${acct.envKey}_EMAIL`] = acct.email
    merged[`QA_${acct.envKey}_PASSWORD`] = acct.password
  }
  // Re-emit the file alphabetically with QA_ block at the bottom.
  const lines: string[] = []
  for (const key of Object.keys(merged).sort()) {
    lines.push(`${key}=${merged[key]}`)
  }
  writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8')
  console.log(`[seed-qa] wrote credentials to ${envPath}`)
  console.log('[seed-qa] done')
}

main().catch((err) => {
  console.error('[seed-qa] failed:', err)
  process.exit(1)
})
