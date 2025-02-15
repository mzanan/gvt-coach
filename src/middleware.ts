import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
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
}

export const config = {
  matcher: '/api/:path*',
}