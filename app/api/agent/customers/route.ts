import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/response'

interface CustomerRecord {
  customer_id: number
  customer_name: string
  customer_phone: string
  customer_info1: string | null
  customer_info2: string | null
  customer_info3: string | null
  data_status: string
  db_id: number
  db_title: string
  db_date: string
  assigned_at: string | null
  call_result: string | null
  consultation_result: string | null
  call_datetime: string | null
  call_duration: string | null
  memo: string | null
  has_audio: boolean
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const dbId = searchParams.get('dbId')
    const status = searchParams.get('status') // 미사용, 통화중, 완료
    const search = searchParams.get('search')

    // Build query dynamically
    let whereConditions = ['c.assigned_user_id = ?']
    let queryParams: any[] = [user.userId]

    // Filter by dbId if provided
    if (dbId) {
      whereConditions.push('c.db_id = ?')
      queryParams.push(parseInt(dbId))
    }

    // Filter by status if provided
    if (status) {
      whereConditions.push('c.data_status = ?')
      queryParams.push(status)
    }

    // Search by name or phone if provided
    if (search) {
      whereConditions.push('(c.customer_name LIKE ? OR c.customer_phone LIKE ?)')
      queryParams.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = whereConditions.join(' AND ')

    // Get assigned customers for the agent
    const customers = await query<CustomerRecord[]>(
      `SELECT
        c.customer_id,
        c.customer_name,
        c.customer_phone,
        c.customer_info1,
        c.customer_info2,
        c.customer_info3,
        c.data_status,
        c.db_id,
        dl.db_title,
        dl.db_date,
        c.updated_at AS assigned_at,
        c.call_result,
        c.consultation_result,
        c.call_datetime,
        c.call_duration,
        c.memo,
        CASE WHEN cl.has_audio IS NOT NULL THEN cl.has_audio ELSE FALSE END as has_audio
      FROM customers c
      LEFT JOIN db_lists dl ON c.db_id = dl.db_id
      LEFT JOIN call_logs cl ON c.customer_id = cl.customer_id
      WHERE ${whereClause}
      ORDER BY c.updated_at DESC`,
      queryParams
    )

    // Format response
    const formattedCustomers = (customers || []).map((customer) => ({
      customerId: customer.customer_id,
      name: customer.customer_name,
      phone: customer.customer_phone,
      info1: customer.customer_info1 || '',
      info2: customer.customer_info2 || '',
      info3: customer.customer_info3 || '',
      status: customer.data_status,
      dbId: customer.db_id,
      dbTitle: customer.db_title || '',
      dbDate: customer.db_date || '',
      assignedAt: customer.assigned_at || '',
      callResult: customer.call_result || null,
      consultationResult: customer.consultation_result || null,
      callDateTime: customer.call_datetime || null,
      callDuration: customer.call_duration || null,
      memo: customer.memo || null,
      hasAudio: customer.has_audio,
    }))

    return successResponse({
      total: formattedCustomers.length,
      customers: formattedCustomers,
    })
  } catch (error: any) {
    console.error('Get agent customers error:', error)
    return serverErrorResponse('고객 목록 조회 중 오류가 발생했습니다.', error)
  }
}
