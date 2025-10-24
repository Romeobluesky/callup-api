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
  { params }: { params: { companyId: string } }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Check super admin role
    if (user.role !== 'super_admin') {
      return forbiddenResponse('슈퍼 관리자 권한이 필요합니다.')
    }

    const companyId = parseInt(params.companyId)

    if (isNaN(companyId)) {
      return errorResponse('유효하지 않은 업체 ID입니다.', 'INVALID_COMPANY_ID', 400)
    }

    // Delete company (will fail if foreign key constraints exist)
    await query('DELETE FROM companies WHERE company_id = ?', [companyId])

    return successResponse(null, '업체가 삭제되었습니다.', 200)
  } catch (error: any) {
    console.error('Delete company error:', error)

    // Check for foreign key constraint error
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return errorResponse(
        '관련 데이터가 존재하여 삭제할 수 없습니다. 비활성화를 권장합니다.',
        'CANNOT_DELETE_COMPANY',
        409
      )
    }

    return serverErrorResponse('업체 삭제 중 오류가 발생했습니다.', error)
  }
}
