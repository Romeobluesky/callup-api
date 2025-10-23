import { NextRequest } from 'next/server'
import { query, transaction } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'

interface CallLogRequest {
  customerId: number
  dbId: number
  callResult: string
  consultationResult?: string
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

    const body: CallLogRequest = await request.json()

    // Validate required fields
    if (!body.customerId || !body.dbId || !body.callResult) {
      return errorResponse('필수 정보가 누락되었습니다.', 'MISSING_FIELDS', 400)
    }

    // Execute transaction
    const result = await transaction(async (connection) => {
      // 1. Insert call log
      const [callLogResult] = await connection.execute(
        `INSERT INTO call_logs (
          user_id,
          customer_id,
          db_id,
          call_result,
          consultation_result,
          memo,
          call_datetime,
          call_start_time,
          call_end_time,
          call_duration
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          user.userId,
          body.customerId,
          body.dbId,
          body.callResult,
          body.consultationResult || null,
          body.memo || null,
          body.callStartTime || null,
          body.callEndTime || null,
          body.callDuration || null,
        ]
      )

      const insertResult = callLogResult as any
      const callLogId = insertResult.insertId

      // 2. Update customer record
      await connection.execute(
        `UPDATE customers
         SET
           data_status = '사용완료',
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
          body.consultationResult || null,
          body.memo || null,
          body.callStartTime || null,
          body.callEndTime || null,
          body.callDuration || null,
          body.reservationDate || null,
          body.reservationTime || null,
          body.customerId,
        ]
      )

      // 3. Update db_lists unused_count
      await connection.execute(
        `UPDATE db_lists
         SET unused_count = unused_count - 1
         WHERE db_id = ? AND unused_count > 0`,
        [body.dbId]
      )

      // 4. Update statistics
      const callDurationSeconds = body.callDuration
        ? body.callDuration.split(':').reduce((acc, time) => 60 * acc + parseInt(time), 0)
        : 0

      await connection.execute(
        `INSERT INTO statistics (
          user_id,
          stat_date,
          total_call_count,
          total_call_time,
          success_count,
          failed_count,
          callback_count,
          no_answer_count
        )
        VALUES (
          ?,
          CURDATE(),
          1,
          SEC_TO_TIME(?),
          IF(? LIKE '%성공%', 1, 0),
          IF(? LIKE '%실패%' OR ? LIKE '%부재%', 1, 0),
          IF(? LIKE '%재통화%' OR ? LIKE '%재연락%', 1, 0),
          IF(? LIKE '%무응답%', 1, 0)
        )
        ON DUPLICATE KEY UPDATE
          total_call_count = total_call_count + 1,
          total_call_time = SEC_TO_TIME(TIME_TO_SEC(total_call_time) + ?),
          success_count = success_count + IF(? LIKE '%성공%', 1, 0),
          failed_count = failed_count + IF(? LIKE '%실패%' OR ? LIKE '%부재%', 1, 0),
          callback_count = callback_count + IF(? LIKE '%재통화%' OR ? LIKE '%재연락%', 1, 0),
          no_answer_count = no_answer_count + IF(? LIKE '%무응답%', 1, 0)`,
        [
          user.userId,
          callDurationSeconds,
          body.callResult,
          body.callResult,
          body.callResult,
          body.callResult,
          body.callResult,
          body.callResult,
          callDurationSeconds,
          body.callResult,
          body.callResult,
          body.callResult,
          body.callResult,
          body.callResult,
          body.callResult,
        ]
      )

      return callLogId
    })

    return successResponse(
      {
        callLogId: result,
      },
      '통화 결과가 저장되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('Call log error:', error)
    return serverErrorResponse('통화 결과 저장 중 오류가 발생했습니다.', error)
  }
}
