import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'

interface UserInfo {
  user_id: number
  user_name: string
  user_phone: string | null
  user_status_message: string | null
  is_active: boolean
  updated_at: string
}

interface TodayStats {
  call_count: number
  call_duration: string
}

interface CallResults {
  connected: number
  failed: number
  callback: number
}

interface DbList {
  db_id: number
  upload_date: string
  file_name: string
  total_count: number
  unused_count: number
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // 1. Get user information
    const userInfoResult = await query<UserInfo[]>(
      `SELECT
        user_id,
        user_name,
        user_phone,
        user_status_message,
        is_active,
        updated_at
      FROM users
      WHERE user_id = ?`,
      [user.userId]
    )

    if (!userInfoResult || userInfoResult.length === 0) {
      return unauthorizedResponse('사용자 정보를 찾을 수 없습니다.')
    }

    const userInfo = userInfoResult[0]

    // 2. Get today's statistics
    const todayStatsResult = await query<TodayStats[]>(
      `SELECT
        COALESCE(total_call_count, 0) as call_count,
        COALESCE(total_call_time, '00:00:00') as call_duration
      FROM statistics
      WHERE user_id = ? AND stat_date = CURDATE()`,
      [user.userId]
    )

    const todayStats = todayStatsResult?.[0] || {
      call_count: 0,
      call_duration: '00:00:00',
    }

    // 3. Get today's call results aggregation
    const callResultsResult = await query<CallResults[]>(
      `SELECT
        SUM(CASE
          WHEN call_result LIKE '%연결성공%' OR call_result LIKE '%통화성공%'
          THEN 1 ELSE 0
        END) AS connected,
        SUM(CASE
          WHEN call_result LIKE '%연결실패%' OR call_result LIKE '%부재중%' OR call_result LIKE '%무응답%'
          THEN 1 ELSE 0
        END) AS failed,
        SUM(CASE
          WHEN call_result LIKE '%재연락%' OR call_result LIKE '%재통화%'
          THEN 1 ELSE 0
        END) AS callback
      FROM call_logs
      WHERE user_id = ? AND DATE(call_datetime) = CURDATE()`,
      [user.userId]
    )

    const callResults = callResultsResult?.[0] || {
      connected: 0,
      failed: 0,
      callback: 0,
    }

    // 4. Get DB lists (최근 3개)
    const dbListsResult = await query<DbList[]>(
      `SELECT
        db_id,
        upload_date,
        file_name,
        total_count,
        unused_count
      FROM db_lists
      WHERE is_active = TRUE
      ORDER BY upload_date DESC
      LIMIT 3`,
      []
    )

    const dbLists =
      dbListsResult?.map((db) => ({
        dbId: db.db_id,
        date: db.upload_date,
        title: db.file_name,
        totalCount: db.total_count,
        unusedCount: db.unused_count,
      })) || []

    // Return dashboard data
    return successResponse({
      user: {
        userId: userInfo.user_id,
        userName: userInfo.user_name,
        phone: userInfo.user_phone || '',
        statusMessage: userInfo.user_status_message || '',
        isActive: userInfo.is_active,
        lastActiveTime: userInfo.updated_at,
      },
      todayStats: {
        callCount: todayStats.call_count,
        callDuration: todayStats.call_duration,
      },
      callResults: {
        connected: Number(callResults.connected) || 0,
        failed: Number(callResults.failed) || 0,
        callback: Number(callResults.callback) || 0,
      },
      dbLists,
    })
  } catch (error: any) {
    console.error('Dashboard error:', error)
    return serverErrorResponse('대시보드 조회 중 오류가 발생했습니다.', error)
  }
}
