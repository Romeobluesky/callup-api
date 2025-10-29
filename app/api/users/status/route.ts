import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'

interface StatusUpdateRequest {
  isActive?: boolean
  statusMessage?: string
}

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const body: StatusUpdateRequest = await request.json()

    // Validate input - at least one field must be provided
    if (body.isActive === undefined && body.statusMessage === undefined) {
      return errorResponse('업데이트할 정보를 입력해주세요.', 'MISSING_FIELDS', 400)
    }

    // Build dynamic update query
    const updateFields: string[] = []
    const updateValues: any[] = []

    if (body.isActive !== undefined) {
      updateFields.push('is_active = ?')
      updateValues.push(body.isActive)
    }

    if (body.statusMessage !== undefined) {
      updateFields.push('user_status_message = ?')
      updateValues.push(body.statusMessage)
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP')

    // Add user_id and company_login_id for WHERE clause (보안)
    updateValues.push(user.userId)
    updateValues.push(user.companyLoginId)

    // Execute update query (company_login_id 조건 추가)
    await query(
      `UPDATE users
       SET ${updateFields.join(', ')}
       WHERE user_id = ? AND company_login_id = ?`,
      updateValues
    )

    return successResponse(
      {
        updated: true,
      },
      '상태가 업데이트되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('User status update error:', error)
    return serverErrorResponse('상태 업데이트 중 오류가 발생했습니다.', error)
  }
}
