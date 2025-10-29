import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { generateToken } from '@/lib/jwt'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/response'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user with old token
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('유효하지 않은 토큰입니다.')
    }

    // Generate new token with same payload (companyLoginId 포함)
    const newToken = generateToken({
      userId: user.userId,
      companyId: user.companyId,
      companyLoginId: user.companyLoginId,
      userName: user.userName,
      role: user.role,
    })

    return successResponse(
      {
        token: newToken,
      },
      '토큰 갱신 성공',
      200
    )
  } catch (error: any) {
    console.error('Token refresh error:', error)
    return serverErrorResponse('토큰 갱신 중 오류가 발생했습니다.', error)
  }
}
