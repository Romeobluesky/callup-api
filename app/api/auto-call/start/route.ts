import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface StartRequest {
  dbId: number
  count: number
}

interface Customer {
  customer_id: number
  db_id: number
  customer_name: string
  customer_phone: string
  customer_info1: string | null
  customer_info2: string | null
  customer_info3: string | null
  event_name: string | null
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const body: StartRequest = await request.json()

    // Validate input
    if (!body.dbId || !body.count) {
      return errorResponse('dbId와 count가 필요합니다.', 'MISSING_FIELDS', 400)
    }

    if (body.count < 1 || body.count > 1000) {
      return errorResponse('count는 1~1000 사이여야 합니다.', 'INVALID_COUNT', 400)
    }

    // Debug log
    console.log('=== Auto-call start request ===')
    console.log('User:', { userId: user.userId, companyId: user.companyId })
    console.log('Body:', { dbId: body.dbId, count: body.count })

    // Ensure count is a safe number for LIMIT clause
    const limit = Math.max(1, Math.min(1000, parseInt(String(body.count))))
    console.log('Query params:', [body.dbId, user.userId])
    console.log('LIMIT value:', limit)

    // 1. 내가 배정받은 미사용 고객 조회 (관리자가 이미 배정한 상태)
    // Note: LIMIT를 직접 문자열로 삽입 (prepared statement binding 문제 회피)
    const customers = await query<Customer[]>(
      `SELECT customer_id, db_id, customer_name, customer_phone,
              customer_info1, customer_info2, customer_info3, event_name
       FROM customers
       WHERE db_id = ?
         AND assigned_user_id = ?
         AND data_status = '미사용'
       ORDER BY customer_id
       LIMIT ${limit}`,
      [body.dbId, user.userId]
    )

    if (!customers || customers.length === 0) {
      return errorResponse(
        '배정받은 미사용 고객이 없습니다.',
        'NO_ASSIGNED_CUSTOMERS',
        404
      )
    }

    // 2. 전체 배정받은 고객 개수 조회 (미사용 + 사용완료 모두 포함)
    const totalResult = await query<any[]>(
      `SELECT COUNT(*) as total
       FROM customers
       WHERE db_id = ?
         AND assigned_user_id = ?`,
      [body.dbId, user.userId]
    )

    const totalCount = totalResult[0]?.total || 0
    console.log('전체 배정받은 고객 수:', totalCount)

    // Format response
    const formattedCustomers = customers.map((c: Customer) => ({
      customerId: c.customer_id,
      dbId: c.db_id,
      name: c.customer_name,
      phone: c.customer_phone,
      info1: c.customer_info1 || '',
      info2: c.customer_info2 || '',
      info3: c.customer_info3 || '',
      eventName: c.event_name || '',
      dataStatus: '미사용',
    }))

    return successResponse(
      {
        customers: formattedCustomers,
        totalCount: totalCount,
      },
      '고객 큐 조회 성공',
      200
    )
  } catch (error: any) {
    console.error('Auto call start error:', error)
    return serverErrorResponse(
      error.message || '자동 통화 시작 중 오류가 발생했습니다.',
      error
    )
  }
}
