import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/response'

interface CustomerRecord {
  customer_id: number
  customer_phone: string
  customer_name: string
  customer_info1: string | null
  customer_info2: string | null
  customer_info3: string | null
}

interface ProgressInfo {
  completed: number
  total_count: number
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Get dbId from query parameters
    const { searchParams } = new URL(request.url)
    const dbIdParam = searchParams.get('dbId')

    if (!dbIdParam) {
      return errorResponse('DB ID가 필요합니다.', 'MISSING_DB_ID', 400)
    }

    const dbId = parseInt(dbIdParam)

    if (isNaN(dbId)) {
      return errorResponse('유효하지 않은 DB ID입니다.', 'INVALID_DB_ID', 400)
    }

    // Get next unused customer
    const customers = await query<CustomerRecord[]>(
      `SELECT
        customer_id,
        customer_phone,
        customer_name,
        customer_info1,
        customer_info2,
        customer_info3
      FROM customers
      WHERE db_id = ? AND data_status = '미사용'
      ORDER BY customer_id ASC
      LIMIT 1`,
      [dbId]
    )

    // Check if customer found
    if (!customers || customers.length === 0) {
      return notFoundResponse('모든 고객에 대한 통화가 완료되었습니다.')
    }

    const customer = customers[0]

    // Get progress information
    const progressResult = await query<ProgressInfo[]>(
      `SELECT
        (total_count - unused_count) AS completed,
        total_count
      FROM db_lists
      WHERE db_id = ?`,
      [dbId]
    )

    const progress = progressResult?.[0]
    const progressStr = progress
      ? `${progress.completed + 1}/${progress.total_count}`
      : '1/1'

    return successResponse({
      customerId: customer.customer_id,
      phone: customer.customer_phone,
      name: customer.customer_name,
      info1: customer.customer_info1 || '',
      info2: customer.customer_info2 || '',
      info3: customer.customer_info3 || '',
      progress: progressStr,
    })
  } catch (error: any) {
    console.error('Next customer error:', error)
    return serverErrorResponse('다음 고객 조회 중 오류가 발생했습니다.', error)
  }
}
