import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type') || 'invite'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', siteUrl))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(`${siteUrl}/confirm`)}`

  try {
    const response = await fetch(verifyUrl, {
      redirect: 'manual',
      headers: { apikey: anonKey },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        return NextResponse.redirect(location)
      }
    }
  } catch {
    // fall through to error
  }

  return NextResponse.redirect(new URL('/login?error=invalid_invite', siteUrl))
}
