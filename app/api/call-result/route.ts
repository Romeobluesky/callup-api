import { NextRequest } from 'next/server'
import { query, transaction } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface CallResultRequest {
  customerId: number
  dbId: number
  callResult: string
  consultationResult: string
  memo?: string
  callStartTime: string
  callEndTime: string
  callDuration: string
  reservationDate?: string
  reservationTime?: string
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const body: CallResultRequest = await request.json()

    // Validate required fields
    if (
      !body.customerId ||
      !body.dbId ||
      !body.callResult ||
      !body.consultationResult ||
      !body.callStartTime ||
      !body.callEndTime ||
      !body.callDuration
    ) {
      return errorResponse(
        '필수 필드가 누락되었습니다.',
        'MISSING_FIELDS',
        400
      )
    }

    // Use transaction for data consistency
    const result = await transaction(async (conn) => {
      // 1. 통화 로그 삽입
      const [logResult] = await conn.execute(
        `INSERT INTO call_logs (
          company_id, user_id, customer_id, db_id,
          call_datetime, call_start_time, call_end_time, call_duration,
          call_result, consultation_result, memo
        ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
          user.companyId,
          user.userId,
          body.customerId,
          body.dbId,
          body.callStartTime,
          body.callEndTime,
          body.callDuration,
          body.callResult,
          body.consultationResult,
          body.memo || null,
        ]
      )

      const logId = (logResult as any).insertId

      // 2. 고객 정보 업데이트
      await conn.execute(
        `UPDATE customers
         SET data_status = '사용완료',
             call_result = ?,
             consultation_result = ?,
             memo = ?,
             call_datetime = NOW(),
             call_start_time = ?,
             call_end_time = ?,
             call_duration = ?,
             reservation_date = ?,
             reservation_time = ?,
             last_modified_date = NOW()
         WHERE customer_id = ?`,
        [
          body.callResult,
          body.consultationResult,
          body.memo || null,
          body.callStartTime,
          body.callEndTime,
          body.callDuration,
          body.reservationDate || null,
          body.reservationTime || null,
          body.customerId,
        ]
      )

      return { logId, customerId: body.customerId }
    })

    return successResponse(result, '통화 결과 저장 완료', 200)
  } catch (error: any) {
    console.error('Call result error:', error)
    return serverErrorResponse('통화 결과 저장 중 오류가 발생했습니다.', error)
  }
}
