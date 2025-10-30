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

    console.log('=== 통화 로그 저장 시작 ===')
    console.log('User:', { userId: user.userId, companyId: user.companyId })
    console.log('Body:', body)

    // Use transaction for data consistency
    const logId = await transaction(async (conn) => {
      try {
        // 1. 통화 로그 삽입
        console.log('Step 1: call_logs 테이블 삽입 중...')
        console.log('INSERT params:', [
          user.companyLoginId,
          user.userId,
          body.customerId,
          body.dbId,
          body.callDuration || '00:00:00',
          body.callResult,
          body.consultationResult || '자동 부재중 처리',
        ])

        const [result] = await conn.execute(
          `INSERT INTO call_logs (
            company_login_id, user_id, customer_id, db_id,
            call_datetime, call_duration, call_result, consultation_result
          ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
          [
            user.companyLoginId,
            user.userId,
            body.customerId,
            body.dbId,
            body.callDuration || '00:00:00',
            body.callResult,
            body.consultationResult || '자동 부재중 처리',
          ]
        )

        const insertId = (result as any).insertId
        console.log('call_logs 삽입 성공, logId:', insertId)

        // 2. 고객 정보 업데이트
        console.log('Step 2: customers 테이블 업데이트 중...')
        console.log('UPDATE params:', [
          body.callResult,
          body.consultationResult || '자동 부재중 처리',
          body.callDuration || '00:00:00',
          body.customerId,
        ])

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

        console.log('customers 업데이트 성공')
        console.log('=== 통화 로그 저장 완료 ===')

        return insertId
      } catch (txError: any) {
        console.error('=== Transaction 내부 에러 ===')
        console.error('에러 타입:', txError?.constructor?.name)
        console.error('에러 메시지:', txError?.message)
        console.error('SQL 에러 코드:', txError?.code)
        console.error('SQL 에러 번호:', txError?.errno)
        console.error('SQL 에러 상태:', txError?.sqlState)
        console.error('SQL 쿼리:', txError?.sql)
        console.error('에러 스택:', txError?.stack)
        throw txError
      }
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
