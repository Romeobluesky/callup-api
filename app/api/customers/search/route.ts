import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/response'

interface CustomerSearchRecord {
  customer_id: number
  upload_date: string
  event_name: string | null
  customer_name: string
  customer_phone: string
  call_result: string | null
  call_datetime: string | null
  call_duration: string | null
  memo: string | null
  has_audio: boolean
}

interface CountResult {
  total: number
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Get search parameters
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const phone = searchParams.get('phone')
    const eventName = searchParams.get('eventName')
    const callResult = searchParams.get('callResult')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query with filters
    let searchQuery = `
      SELECT
        c.customer_id,
        dl.upload_date,
        c.event_name,
        c.customer_name,
        c.customer_phone,
        c.call_result,
        c.call_datetime,
        c.call_duration,
        c.memo,
        c.has_audio
      FROM customers c
      JOIN db_lists dl ON c.db_id = dl.db_id
      WHERE 1=1`

    const queryParams: any[] = []

    if (name) {
      searchQuery += ` AND c.customer_name LIKE ?`
      queryParams.push(`%${name}%`)
    }

    if (phone) {
      searchQuery += ` AND c.customer_phone LIKE ?`
      queryParams.push(`%${phone}%`)
    }

    if (eventName) {
      searchQuery += ` AND c.event_name LIKE ?`
      queryParams.push(`%${eventName}%`)
    }

    if (callResult) {
      searchQuery += ` AND c.call_result LIKE ?`
      queryParams.push(`%${callResult}%`)
    }

    searchQuery += `
      ORDER BY c.call_datetime DESC
      LIMIT ? OFFSET ?`

    queryParams.push(limit, offset)

    // Execute search query
    const customers = await query<CustomerSearchRecord[]>(searchQuery, queryParams)

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM customers c
      JOIN db_lists dl ON c.db_id = dl.db_id
      WHERE 1=1`

    const countParams: any[] = []

    if (name) {
      countQuery += ` AND c.customer_name LIKE ?`
      countParams.push(`%${name}%`)
    }

    if (phone) {
      countQuery += ` AND c.customer_phone LIKE ?`
      countParams.push(`%${phone}%`)
    }

    if (eventName) {
      countQuery += ` AND c.event_name LIKE ?`
      countParams.push(`%${eventName}%`)
    }

    if (callResult) {
      countQuery += ` AND c.call_result LIKE ?`
      countParams.push(`%${callResult}%`)
    }

    const countResult = await query<CountResult[]>(countQuery, countParams)
    const totalCount = countResult?.[0]?.total || 0

    // Format response
    const formattedCustomers = (customers || []).map((customer) => ({
      customerId: customer.customer_id,
      date: customer.upload_date,
      eventName: customer.event_name || '',
      name: customer.customer_name,
      phone: customer.customer_phone,
      callStatus: customer.call_result || '',
      callDateTime: customer.call_datetime || '',
      callDuration: customer.call_duration || '',
      customerType: '', // 고객유형은 삭제됨
      memo: customer.memo || '',
      hasAudio: customer.has_audio,
    }))

    return successResponse({
      customers: formattedCustomers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    })
  } catch (error: any) {
    console.error('Customer search error:', error)
    return serverErrorResponse('고객 검색 중 오류가 발생했습니다.', error)
  }
}
