import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { userId } = getAuth(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
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
