import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await req.json()
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 })
  }

  const { data, error } = await supabase.storage
    .from('service-photos')
    .createSignedUrl(path, 300) // 5 minutes TTL

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
