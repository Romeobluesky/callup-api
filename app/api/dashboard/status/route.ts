import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface StatusUpdateRequest {
  isOn: boolean
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const body: StatusUpdateRequest = await request.json()

    if (typeof body.isOn !== 'boolean') {
      return errorResponse('isOn 값이 필요합니다.', 'MISSING_FIELDS', 400)
    }

    // Update user status (company_login_id 사용)
    const statusMessage = body.isOn ? '업무 중' : '대기 중'

    await query(
      `UPDATE users
       SET user_status_message = ?
       WHERE user_id = ? AND company_login_id = ?`,
      [statusMessage, user.userId, user.companyLoginId]
    )

    return successResponse(
      {
        isOn: body.isOn,
      },
      '상태가 업데이트되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('Status update error:', error)
    return serverErrorResponse('상태 업데이트 중 오류가 발생했습니다.', error)
  }
}
