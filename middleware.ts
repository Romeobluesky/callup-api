import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // CORS headers
  const response = NextResponse.next()

  // Allow all origins in development, specific origins in production
  const origin = request.headers.get('origin')
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*']

  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*')
  }

  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  )

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    })
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
