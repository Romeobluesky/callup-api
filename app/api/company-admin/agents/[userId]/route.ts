import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Check company admin or super admin role
    if (user.role !== 'company_admin' && user.role !== 'super_admin') {
      return forbiddenResponse('업체 관리자 권한이 필요합니다.')
    }

    const userId = parseInt(params.userId)

    if (isNaN(userId)) {
      return errorResponse('유효하지 않은 사용자 ID입니다.', 'INVALID_USER_ID', 400)
    }

    // Deactivate agent (soft delete)
    await query(
      'UPDATE users SET is_active = FALSE WHERE user_id = ? AND company_id = ?',
      [userId, user.companyId]
    )

    return successResponse(null, '상담원이 비활성화되었습니다.', 200)
  } catch (error: any) {
    console.error('Delete agent error:', error)
    return serverErrorResponse('상담원 삭제 중 오류가 발생했습니다.', error)
  }
}
