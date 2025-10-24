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

interface ToggleRequest {
  isActive: boolean
}

export async function PUT(
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

    const body: ToggleRequest = await request.json()

    if (typeof body.isActive !== 'boolean') {
      return errorResponse('isActive 값이 필요합니다.', 'MISSING_FIELDS', 400)
    }

    // Update company status
    await query(
      'UPDATE companies SET is_active = ? WHERE company_id = ?',
      [body.isActive, companyId]
    )

    return successResponse(
      {
        companyId,
        isActive: body.isActive,
      },
      '업체 상태가 업데이트되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('Company toggle error:', error)
    return serverErrorResponse('업체 상태 업데이트 중 오류가 발생했습니다.', error)
  }
}
