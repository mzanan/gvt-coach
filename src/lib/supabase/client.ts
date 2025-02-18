import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = createClient()

export async function getToken() {
  const { data: { session }, error } = await supabase.auth.getSession()
  console.log('Session:', session)
  if (error) {
    console.error('Session error:', error)
    return null
  }

  if (!session) {
    console.log('No active session')
    return null 
  }

  return session.access_token
}