import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create response to modify
  let response = NextResponse.next({
    request,
  })

  // Initialize Supabase with request/response cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request,
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request,
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Important: refresh the auth session
  await supabase.auth.getSession()

  // Keep your existing API routing logic
  if (request.nextUrl.pathname.startsWith('/api/') && 
      !request.nextUrl.pathname.startsWith('/api/zoom')) {
    const backendUrl = new URL(
      request.nextUrl.pathname, 
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    )

    const headers = new Headers(request.headers)
    headers.set('Content-Type', 'application/json')

    return NextResponse.rewrite(backendUrl, {
      headers: headers
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/api/:path*'
  ],
}