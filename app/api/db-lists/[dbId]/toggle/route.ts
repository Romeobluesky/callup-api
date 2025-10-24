import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface ToggleRequest {
  isActive: boolean
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { dbId: string } }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const dbId = parseInt(params.dbId)

    if (isNaN(dbId)) {
      return errorResponse('유효하지 않은 DB ID입니다.', 'INVALID_DB_ID', 400)
    }

    const body: ToggleRequest = await request.json()

    if (typeof body.isActive !== 'boolean') {
      return errorResponse('isActive 값이 필요합니다.', 'MISSING_FIELDS', 400)
    }

    // Update DB list status with company_id check
    await query(
      `UPDATE db_lists
       SET is_active = ?
       WHERE db_id = ? AND company_id = ?`,
      [body.isActive, dbId, user.companyId]
    )

    return successResponse(
      {
        dbId,
        isActive: body.isActive,
      },
      'DB 상태가 업데이트되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('DB toggle error:', error)
    return serverErrorResponse('DB 상태 업데이트 중 오류가 발생했습니다.', error)
  }
}
