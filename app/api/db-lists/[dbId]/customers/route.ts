import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'

interface DbInfo {
  db_id: number
  file_name: string
  total_count: number
  unused_count: number
}

interface CustomerRecord {
  customer_id: number
  customer_phone: string
  customer_name: string
  customer_info1: string | null
  customer_info2: string | null
  customer_info3: string | null
  data_status: string
}

interface CountResult {
  total: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dbId: string }> }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const { dbId: dbIdParam } = await params
    const dbId = parseInt(dbIdParam)

    if (isNaN(dbId)) {
      return errorResponse('유효하지 않은 DB ID입니다.', 'INVALID_DB_ID', 400)
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // '미사용' or '사용완료'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // 1. Get DB info
    const dbInfoResult = await query<DbInfo[]>(
      `SELECT
        db_id,
        file_name,
        total_count,
        unused_count
      FROM db_lists
      WHERE db_id = ? AND is_active = TRUE`,
      [dbId]
    )

    if (!dbInfoResult || dbInfoResult.length === 0) {
      return errorResponse('DB를 찾을 수 없습니다.', 'DB_NOT_FOUND', 404)
    }

    const dbInfo = dbInfoResult[0]

    // 2. Get customers with pagination
    let customersQuery = `
      SELECT
        customer_id,
        customer_phone,
        customer_name,
        customer_info1,
        customer_info2,
        customer_info3,
        data_status
      FROM customers
      WHERE db_id = ?`

    const queryParams: any[] = [dbId]

    if (status && (status === '미사용' || status === '사용완료')) {
      customersQuery += ` AND data_status = ?`
      queryParams.push(status)
    }

    customersQuery += `
      ORDER BY customer_id ASC
      LIMIT ? OFFSET ?`

    queryParams.push(limit, offset)

    const customers = await query<CustomerRecord[]>(customersQuery, queryParams)

    // 3. Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM customers
      WHERE db_id = ?`

    const countParams: any[] = [dbId]

    if (status && (status === '미사용' || status === '사용완료')) {
      countQuery += ` AND data_status = ?`
      countParams.push(status)
    }

    const countResult = await query<CountResult[]>(countQuery, countParams)
    const totalCount = countResult?.[0]?.total || 0

    // Format response
    const formattedCustomers = (customers || []).map((customer) => ({
      customerId: customer.customer_id,
      phone: customer.customer_phone,
      name: customer.customer_name,
      info1: customer.customer_info1 || '',
      info2: customer.customer_info2 || '',
      info3: customer.customer_info3 || '',
      dataStatus: customer.data_status,
    }))

    return successResponse({
      dbInfo: {
        dbId: dbInfo.db_id,
        title: dbInfo.file_name,
        totalCount: dbInfo.total_count,
        unusedCount: dbInfo.unused_count,
      },
      customers: formattedCustomers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    })
  } catch (error: any) {
    console.error('DB customers error:', error)
    return serverErrorResponse('고객 목록 조회 중 오류가 발생했습니다.', error)
  }
}
