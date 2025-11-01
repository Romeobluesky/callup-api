import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/response'

interface StatsRecord {
  total_recordings: number
  total_size: number
  total_duration: number
}

interface StatusStatsRecord {
  upload_status: string
  count: number
}

interface FormatStatsRecord {
  audio_format: string
  count: number
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

    // Build WHERE conditions
    let whereConditions = ['company_id = ?', 'has_audio = TRUE']
    let queryParams: any[] = [user.companyId]

    if (dateFrom) {
      whereConditions.push('DATE(call_datetime) >= ?')
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      whereConditions.push('DATE(call_datetime) <= ?')
      queryParams.push(dateTo)
    }

    const whereClause = whereConditions.join(' AND ')

    // Get overall statistics
    const overallStats = await query<StatsRecord[]>(
      `SELECT
        COUNT(*) as total_recordings,
        COALESCE(SUM(audio_file_size), 0) as total_size,
        COALESCE(SUM(audio_duration), 0) as total_duration
      FROM call_logs
      WHERE ${whereClause}`,
      queryParams
    )

    // Get statistics by upload status
    const statusStats = await query<StatusStatsRecord[]>(
      `SELECT
        upload_status,
        COUNT(*) as count
      FROM call_logs
      WHERE company_id = ?
      GROUP BY upload_status`,
      [user.companyId]
    )

    // Get statistics by format
    const formatStats = await query<FormatStatsRecord[]>(
      `SELECT
        audio_format,
        COUNT(*) as count
      FROM call_logs
      WHERE ${whereClause} AND audio_format IS NOT NULL
      GROUP BY audio_format`,
      queryParams
    )

    // Format statistics
    const byStatus: { [key: string]: number } = {}
    statusStats.forEach((stat) => {
      byStatus[stat.upload_status] = stat.count
    })

    const byFormat: { [key: string]: number } = {}
    formatStats.forEach((stat) => {
      byFormat[stat.audio_format] = stat.count
    })

    return successResponse({
      totalRecordings: overallStats[0]?.total_recordings || 0,
      totalSize: overallStats[0]?.total_size || 0,
      totalDuration: overallStats[0]?.total_duration || 0,
      byStatus: {
        completed: byStatus['completed'] || 0,
        failed: byStatus['failed'] || 0,
        pending: byStatus['pending'] || 0,
        uploading: byStatus['uploading'] || 0,
      },
      byFormat,
    })
  } catch (error: any) {
    console.error('Get recordings stats error:', error)
    return serverErrorResponse('녹취 통계 조회 중 오류가 발생했습니다.', error)
  }
}
