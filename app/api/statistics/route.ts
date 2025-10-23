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
  call_count: number
  call_duration: string
}

interface CallResultStats {
  connected: number
  failed: number
  promising: number
  callback: number
  no_answer: number
}

interface DbStats {
  total_db: number
  unused_db: number
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
    let callLogDateCondition = ''

    switch (period) {
      case 'today':
        dateCondition = 'stat_date = CURDATE()'
        callLogDateCondition = 'DATE(call_datetime) = CURDATE()'
        break
      case 'week':
        dateCondition = `stat_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
                        AND stat_date <= CURDATE()`
        callLogDateCondition = `call_datetime >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`
        break
      case 'month':
        dateCondition = `YEAR(stat_date) = YEAR(CURDATE())
                        AND MONTH(stat_date) = MONTH(CURDATE())`
        callLogDateCondition = `YEAR(call_datetime) = YEAR(CURDATE())
                               AND MONTH(call_datetime) = MONTH(CURDATE())`
        break
      case 'all':
        dateCondition = '1=1'
        callLogDateCondition = '1=1'
        break
    }

    // 1. Get call count and duration from statistics
    const statsResult = await query<StatsRecord[]>(
      `SELECT
        COALESCE(SUM(total_call_count), 0) AS call_count,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(total_call_time))), '00:00:00') AS call_duration
      FROM statistics
      WHERE user_id = ? AND ${dateCondition}`,
      [user.userId]
    )

    const stats = statsResult?.[0] || {
      call_count: 0,
      call_duration: '00:00:00',
    }

    // 2. Get call results aggregation from call_logs
    const callResultsResult = await query<CallResultStats[]>(
      `SELECT
        SUM(CASE WHEN call_result LIKE '%통화성공%' OR call_result LIKE '%연결성공%' THEN 1 ELSE 0 END) AS connected,
        SUM(CASE WHEN call_result LIKE '%연결실패%' OR call_result LIKE '%부재중%' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN consultation_result LIKE '%가망고객%' THEN 1 ELSE 0 END) AS promising,
        SUM(CASE WHEN call_result LIKE '%재연락%' OR call_result LIKE '%재통화%' THEN 1 ELSE 0 END) AS callback,
        SUM(CASE WHEN call_result LIKE '%무응답%' THEN 1 ELSE 0 END) AS no_answer
      FROM call_logs
      WHERE user_id = ? AND ${callLogDateCondition}`,
      [user.userId]
    )

    const callResults = callResultsResult?.[0] || {
      connected: 0,
      failed: 0,
      promising: 0,
      callback: 0,
      no_answer: 0,
    }

    // 3. Get DB statistics (total and unused)
    const dbStatsResult = await query<DbStats[]>(
      `SELECT
        COALESCE(SUM(total_count), 0) AS total_db,
        COALESCE(SUM(unused_count), 0) AS unused_db
      FROM db_lists
      WHERE is_active = TRUE`,
      []
    )

    const dbStats = dbStatsResult?.[0] || {
      total_db: 0,
      unused_db: 0,
    }

    return successResponse({
      period,
      callDuration: stats.call_duration,
      callCount: Number(stats.call_count) || 0,
      connected: Number(callResults.connected) || 0,
      failed: Number(callResults.failed) || 0,
      promising: Number(callResults.promising) || 0,
      callback: Number(callResults.callback) || 0,
      noAnswer: Number(callResults.no_answer) || 0,
      totalDb: Number(dbStats.total_db) || 0,
      unusedDb: Number(dbStats.unused_db) || 0,
    })
  } catch (error: any) {
    console.error('Statistics error:', error)
    return serverErrorResponse('통계 조회 중 오류가 발생했습니다.', error)
  }
}
