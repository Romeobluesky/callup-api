import { NextRequest } from 'next/server'
import { query, transaction } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface LogRequest {
  customerId: number
  dbId: number
  callResult: string
  consultationResult: string
  callDuration: string
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const body: LogRequest = await request.json()

    // Validate input
    if (!body.customerId || !body.dbId || !body.callResult) {
      return errorResponse(
        'customerId, dbId, callResult가 필요합니다.',
        'MISSING_FIELDS',
        400
      )
    }

    // Use transaction for data consistency
    const logId = await transaction(async (conn) => {
      // 1. 통화 로그 삽입
      const [result] = await conn.execute(
        `INSERT INTO call_logs (
          company_id, user_id, customer_id, db_id,
          call_datetime, call_duration, call_result, consultation_result
        ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          user.companyId,
          user.userId,
          body.customerId,
          body.dbId,
          body.callDuration || '00:00:00',
          body.callResult,
          body.consultationResult || '자동 부재중 처리',
        ]
      )

      const insertId = (result as any).insertId

      // 2. 고객 정보 업데이트
      await conn.execute(
        `UPDATE customers
         SET data_status = '사용완료',
             call_result = ?,
             consultation_result = ?,
             call_datetime = NOW(),
             call_duration = ?,
             last_modified_date = NOW()
         WHERE customer_id = ?`,
        [
          body.callResult,
          body.consultationResult || '자동 부재중 처리',
          body.callDuration || '00:00:00',
          body.customerId,
        ]
      )

      // 3. statistics 테이블 업데이트는 트리거로 처리됨
      // 트리거가 없으면 여기서 직접 업데이트 필요

      return insertId
    })

    return successResponse(
      {
        logId,
      },
      '통화 로그 저장 완료',
      200
    )
  } catch (error: any) {
    console.error('Auto call log error:', error)
    return serverErrorResponse('통화 로그 저장 중 오류가 발생했습니다.', error)
  }
}
