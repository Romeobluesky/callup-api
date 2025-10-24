import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/response'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // 로그아웃은 클라이언트에서 토큰을 삭제하면 됨
    // 서버에서는 특별한 처리 없이 성공 응답만 반환
    return successResponse(null, '로그아웃 완료', 200)
  } catch (error: any) {
    console.error('Logout error:', error)
    return successResponse(null, '로그아웃 완료', 200)
  }
}
