import { createClient } from '@/lib/supabase-server'

export async function getServicePhotoUrl(path: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('service-photos')
    .createSignedUrl(path, 300)
  if (error) return null
  return data.signedUrl
}
