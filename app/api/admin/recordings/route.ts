import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/response'

interface RecordingListRecord {
  log_id: number
  company_id: number
  user_id: number
  user_name: string
  customer_id: number
  customer_name: string
  customer_phone: string
  call_result: string
  call_datetime: string
  audio_duration: number | null
  audio_file_size: number | null
  audio_format: string | null
  original_filename: string | null
  uploaded_at: string | null
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Check company admin or super admin role
    if (user.role !== 'company_admin' && user.role !== 'super_admin') {
      return forbiddenResponse('관리자 권한이 필요합니다.')
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const userId = searchParams.get('userId')
    const customerId = searchParams.get('customerId')
    const hasAudio = searchParams.get('hasAudio')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Build WHERE conditions
    let whereConditions = ['cl.company_id = ?']
    let queryParams: any[] = [user.companyId]

    if (dateFrom) {
      whereConditions.push('DATE(cl.call_datetime) >= ?')
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      whereConditions.push('DATE(cl.call_datetime) <= ?')
      queryParams.push(dateTo)
    }

    if (userId) {
      whereConditions.push('cl.user_id = ?')
      queryParams.push(parseInt(userId))
    }

    if (customerId) {
      whereConditions.push('cl.customer_id = ?')
      queryParams.push(parseInt(customerId))
    }

    if (hasAudio !== null && hasAudio !== undefined) {
      whereConditions.push('cl.has_audio = ?')
      queryParams.push(hasAudio === 'true')
    }

    const whereClause = whereConditions.join(' AND ')

    // Get total count
    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total
       FROM call_logs cl
       WHERE ${whereClause}`,
      queryParams
    )

    const total = countResult[0]?.total || 0

    // Get recordings list
    const recordings = await query<RecordingListRecord[]>(
      `SELECT
        cl.log_id,
        cl.company_id,
        cl.user_id,
        u.user_name,
        cl.customer_id,
        c.customer_name,
        c.customer_phone,
        cl.call_result,
        cl.call_datetime,
        cl.audio_duration,
        cl.audio_file_size,
        cl.audio_format,
        cl.original_filename,
        cl.uploaded_at
      FROM call_logs cl
      LEFT JOIN users u ON cl.user_id = u.user_id
      LEFT JOIN customers c ON cl.customer_id = c.customer_id
      WHERE ${whereClause}
      ORDER BY cl.call_datetime DESC
      LIMIT ${limit} OFFSET ${offset}`,
      queryParams
    )

    // Format response
    const formattedRecordings = (recordings || []).map((rec) => ({
      logId: rec.log_id,
      companyId: rec.company_id,
      userId: rec.user_id,
      userName: rec.user_name || '',
      customerId: rec.customer_id,
      customerName: rec.customer_name || '',
      customerPhone: rec.customer_phone || '',
      callResult: rec.call_result || '',
      callDateTime: rec.call_datetime ? new Date(rec.call_datetime).toISOString() : '',
      audioDuration: rec.audio_duration || 0,
      audioFileSize: rec.audio_file_size || 0,
      audioFormat: rec.audio_format || '',
      originalFilename: rec.original_filename || '',
      uploadedAt: rec.uploaded_at ? new Date(rec.uploaded_at).toISOString() : null,
    }))

    return successResponse({
      recordings: formattedRecordings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Get recordings list error:', error)
    return serverErrorResponse('녹취 목록 조회 중 오류가 발생했습니다.', error)
  }
}
