import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface JwtPayload {
  userId: number
  companyId: number
  companyLoginId: string
  userName: string
  role: 'super_admin' | 'company_admin' | 'agent'
  iat?: number
  exp?: number
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as any)
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    return decoded
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
}

/**
 * Decode JWT token without verification (for debugging)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload
  } catch (error) {
    console.error('JWT decode error:', error)
    return null
  }
}
