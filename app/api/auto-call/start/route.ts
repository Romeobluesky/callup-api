import { NextRequest } from 'next/server'
import { query, transaction } from '@/lib/db'
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

    // Use transaction for data consistency
    const result = await transaction(async (conn) => {
      // 1. 미사용 고객 조회
      const [customers] = await conn.execute<any>(
        `SELECT customer_id, db_id, customer_name, customer_phone,
                customer_info1, customer_info2, customer_info3, event_name
         FROM customers
         WHERE db_id = ?
           AND data_status = '미사용'
           AND (assigned_user_id IS NULL OR assigned_user_id = ?)
         ORDER BY customer_id
         LIMIT ?`,
        [body.dbId, user.userId, body.count]
      )

      if (!customers || customers.length === 0) {
        throw new Error('사용 가능한 고객 데이터가 없습니다.')
      }

      const customerIds = customers.map((c: Customer) => c.customer_id)

      // 2. 고객 할당 정보 업데이트
      await conn.execute(
        `UPDATE customers
         SET assigned_user_id = ?
         WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`,
        [user.userId, ...customerIds]
      )

      // 3. DB 할당 추적
      await conn.execute(
        `INSERT INTO db_assignments (db_id, user_id, company_id, assigned_count)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           assigned_count = assigned_count + ?,
           updated_at = NOW()`,
        [body.dbId, user.userId, user.companyId, customers.length, customers.length]
      )

      return customers
    })

    // Format response
    const formattedCustomers = result.map((c: Customer) => ({
      customerId: c.customer_id,
      dbId: c.db_id,
      name: c.customer_name,
      phone: c.customer_phone,
      info1: c.customer_info1 || '',
      info2: c.customer_info2 || '',
      info3: c.customer_info3 || '',
      eventName: c.event_name || '',
    }))

    return successResponse(
      {
        customers: formattedCustomers,
        totalCount: formattedCustomers.length,
      },
      '자동 통화 준비 완료',
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
