import { NextRequest } from 'next/server'
import { verifyToken, JwtPayload } from './jwt'

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return null
  }

  // Check for "Bearer <token>" format
  const parts = authHeader.split(' ')

  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1]
  }

  // If not in Bearer format, return the whole header value
  return authHeader
}

/**
 * Verify authentication and return user payload
 */
export function authenticate(request: NextRequest): JwtPayload | null {
  const token = extractToken(request)

  if (!token) {
    return null
  }

  return verifyToken(token)
}

/**
 * Check if user is authenticated (for middleware)
 */
export function isAuthenticated(request: NextRequest): boolean {
  const user = authenticate(request)
  return user !== null
}
