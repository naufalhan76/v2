/**
 * Shared utilities for the QA suite.
 *
 * The Supabase admin client used by the seeders/db-asserts is loaded from the
 * service-role key because tests need to bypass RLS to seed cross-tenant
 * scenarios cleanly. Tests never hit the admin client through user-facing
 * routes — only through these helpers.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { QaAccounts, QaPrefix } from './types'

let cachedAdmin: SupabaseClient | null = null

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

const envFile = {
  ...loadDotEnv(resolve(process.cwd(), '.env.test.local')),
  ...loadDotEnv(resolve(process.cwd(), '.env.staging')),
}

function envVar(key: string, required = true): string {
  const value = envFile[key] ?? process.env[key]
  if (!value && required) {
    throw new Error(
      `[qa] missing env ${key} — set in .env.test.local or .env.staging`
    )
  }
  return value ?? ''
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin
  const url = envVar('NEXT_PUBLIC_SUPABASE_URL')
  const key = envVar('SUPABASE_SERVICE_ROLE_KEY')
  cachedAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdmin
}

export function loadQaAccounts(): QaAccounts | null {
  const admin = envVar('QA_ADMIN_EMAIL', false)
  const adminPwd = envVar('QA_ADMIN_PASSWORD', false)
  const finance = envVar('QA_FINANCE_EMAIL', false)
  const financePwd = envVar('QA_FINANCE_PASSWORD', false)
  const t1 = envVar('QA_TECH1_EMAIL', false)
  const t1Pwd = envVar('QA_TECH1_PASSWORD', false)
  const t2 = envVar('QA_TECH2_EMAIL', false)
  const t2Pwd = envVar('QA_TECH2_PASSWORD', false)
  if (!admin || !finance || !t1 || !t2) return null
  return {
    admin: { email: admin, password: adminPwd, label: 'admin' },
    finance: { email: finance, password: financePwd, label: 'finance' },
    technicianLead: { email: t1, password: t1Pwd, label: 'tech1-lead' },
    technicianHelper: { email: t2, password: t2Pwd, label: 'tech2-helper' },
  }
}

export function makePrefix(scenarioId: string): QaPrefix {
  // QA-E2E-{scenarioId}-{timestampMs}-{rand}
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `QA-E2E-${scenarioId}-${ts}-${rand}`
}

export function evidenceDir(scenarioId: string): string {
  const dir = resolve(process.cwd(), '.omo/evidence/qa', scenarioId)
  return dir
}
