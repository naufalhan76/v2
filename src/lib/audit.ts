import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function auditLog(
  action: string,
  tableName: string,
  recordId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient()
    const { userId } = await auth()
    
    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action,
      table_name: tableName,
      record_id: recordId || null,
      old_values: oldValues || null,
      new_values: newValues || null,
    })
  } catch (error) {
    logger.warn('Audit log failed (non-blocking):', error)
  }
}
