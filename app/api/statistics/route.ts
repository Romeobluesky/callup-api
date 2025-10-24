import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'

interface StatsRecord {
  total_call_time: string
  total_call_count: number
  success_count: number
  failed_count: number
  callback_count: number
  no_answer_count: number
}

interface DbStats {
  assigned_db_count: number
  unused_db_count: number
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Get period parameter
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'

    if (!['today', 'week', 'month', 'all'].includes(period)) {
      return errorResponse(
        '유효하지 않은 기간입니다. (today, week, month, all)',
        'INVALID_PERIOD',
        400
      )
    }

    // Build date condition based on period
    let dateCondition = ''

    switch (period) {
      case 'today':
        dateCondition = 'AND stat_date = CURDATE()'
        break
      case 'week':
        dateCondition = 'AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
        break
      case 'month':
        dateCondition = 'AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)'
        break
      case 'all':
        dateCondition = ''
        break
    }

    // Get statistics from database
    const statsResult = await query<StatsRecord[]>(
      `SELECT
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(total_call_time))), '00:00:00') AS total_call_time,
        COALESCE(SUM(total_call_count), 0) AS total_call_count,
        COALESCE(SUM(success_count), 0) AS success_count,
        COALESCE(SUM(failed_count), 0) AS failed_count,
        COALESCE(SUM(callback_count), 0) AS callback_count,
        COALESCE(SUM(no_answer_count), 0) AS no_answer_count
      FROM statistics
      WHERE company_id = ? AND user_id = ? ${dateCondition}`,
      [user.companyId, user.userId]
    )

    const stats = statsResult?.[0] || {
      total_call_time: '00:00:00',
      total_call_count: 0,
      success_count: 0,
      failed_count: 0,
      callback_count: 0,
      no_answer_count: 0,
    }

    // Get DB statistics (assigned DB count)
    const dbStatsResult = await query<DbStats[]>(
      `SELECT
        COALESCE(COUNT(DISTINCT db_id), 0) AS assigned_db_count,
        COALESCE(SUM(unused_count), 0) AS unused_db_count
      FROM db_lists
      WHERE company_id = ? AND is_active = TRUE`,
      [user.companyId]
    )

    const dbStats = dbStatsResult?.[0] || {
      assigned_db_count: 0,
      unused_db_count: 0,
    }

    return successResponse({
      user: {
        userName: user.userName,
        userId: user.userId,
      },
      period,
      stats: {
        totalCallTime: stats.total_call_time,
        totalCallCount: Number(stats.total_call_count) || 0,
        successCount: Number(stats.success_count) || 0,
        failedCount: Number(stats.failed_count) || 0,
        callbackCount: Number(stats.callback_count) || 0,
        noAnswerCount: Number(stats.no_answer_count) || 0,
        assignedDbCount: Number(dbStats.assigned_db_count) || 0,
        unusedDbCount: Number(dbStats.unused_db_count) || 0,
      },
    })
  } catch (error: any) {
    console.error('Statistics error:', error)
    return serverErrorResponse('통계 조회 중 오류가 발생했습니다.', error)
  }
}
