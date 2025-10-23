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

interface CustomerDetailRecord {
  customer_id: number
  db_id: number
  event_name: string | null
  customer_phone: string
  customer_name: string
  customer_info1: string | null
  customer_info2: string | null
  customer_info3: string | null
  data_status: string
  call_result: string | null
  consultation_result: string | null
  memo: string | null
  call_datetime: string | null
  call_start_time: string | null
  call_end_time: string | null
  call_duration: string | null
  reservation_date: string | null
  reservation_time: string | null
  upload_date: string | null
  last_modified_date: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const { customerId: customerIdParam } = await params
    const customerId = parseInt(customerIdParam)

    if (isNaN(customerId)) {
      return errorResponse('유효하지 않은 고객 ID입니다.', 'INVALID_CUSTOMER_ID', 400)
    }

    // Get customer detail
    const customers = await query<CustomerDetailRecord[]>(
      `SELECT
        customer_id,
        db_id,
        event_name,
        customer_phone,
        customer_name,
        customer_info1,
        customer_info2,
        customer_info3,
        data_status,
        call_result,
        consultation_result,
        memo,
        call_datetime,
        call_start_time,
        call_end_time,
        call_duration,
        reservation_date,
        reservation_time,
        upload_date,
        last_modified_date
      FROM customers
      WHERE customer_id = ?`,
      [customerId]
    )

    if (!customers || customers.length === 0) {
      return notFoundResponse('고객을 찾을 수 없습니다.')
    }

    const customer = customers[0]

    return successResponse({
      customerId: customer.customer_id,
      dbId: customer.db_id,
      eventName: customer.event_name || '',
      phone: customer.customer_phone,
      name: customer.customer_name,
      info1: customer.customer_info1 || '',
      info2: customer.customer_info2 || '',
      info3: customer.customer_info3 || '',
      dataStatus: customer.data_status,
      callResult: customer.call_result || '',
      consultationResult: customer.consultation_result || '',
      memo: customer.memo || '',
      callDateTime: customer.call_datetime || '',
      callStartTime: customer.call_start_time || '',
      callEndTime: customer.call_end_time || '',
      callDuration: customer.call_duration || '',
      reservationDate: customer.reservation_date || '',
      reservationTime: customer.reservation_time || '',
      uploadDate: customer.upload_date || '',
      lastModifiedDate: customer.last_modified_date || '',
    })
  } catch (error: any) {
    console.error('Customer detail error:', error)
    return serverErrorResponse('고객 상세 조회 중 오류가 발생했습니다.', error)
  }
}
