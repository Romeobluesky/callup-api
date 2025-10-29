import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface AgentStats {
  user_id: number
  user_name: string
  call_count: number
  call_duration: string
  success_count: number
}

interface CompanyStats {
  total_call_time: string
  total_call_count: number
  success_count: number
  failed_count: number
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
      return forbiddenResponse('업체 관리자 권한이 필요합니다.')
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

    // Build date condition
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

    // Get company-wide statistics
    const companyStatsResult = await query<CompanyStats[]>(
      `SELECT
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(total_call_time))), '00:00:00') AS total_call_time,
        COALESCE(SUM(total_call_count), 0) AS total_call_count,
        COALESCE(SUM(success_count), 0) AS success_count,
        COALESCE(SUM(failed_count), 0) AS failed_count
      FROM statistics
      WHERE company_login_id = ? ${dateCondition}`,
      [user.companyLoginId]
    )

    const companyStats = companyStatsResult?.[0] || {
      total_call_time: '00:00:00',
      total_call_count: 0,
      success_count: 0,
      failed_count: 0,
    }

    // Get per-agent statistics
    const agentStatsResult = await query<AgentStats[]>(
      `SELECT
        u.user_id,
        u.user_name,
        COALESCE(SUM(s.total_call_count), 0) AS call_count,
        COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(s.total_call_time))), '00:00:00') AS call_duration,
        COALESCE(SUM(s.success_count), 0) AS success_count
      FROM statistics s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.company_login_id = ? ${dateCondition}
      GROUP BY u.user_id, u.user_name
      ORDER BY call_count DESC`,
      [user.companyLoginId]
    )

    const agentStats = (agentStatsResult || []).map((agent) => ({
      userId: agent.user_id,
      userName: agent.user_name,
      callCount: Number(agent.call_count) || 0,
      callDuration: agent.call_duration,
      successCount: Number(agent.success_count) || 0,
    }))

    return successResponse({
      period,
      companyStats: {
        totalCallTime: companyStats.total_call_time,
        totalCallCount: Number(companyStats.total_call_count) || 0,
        successCount: Number(companyStats.success_count) || 0,
        failedCount: Number(companyStats.failed_count) || 0,
      },
      agentStats,
    })
  } catch (error: any) {
    console.error('Company statistics error:', error)
    return serverErrorResponse('업체별 통계 조회 중 오류가 발생했습니다.', error)
  }
}
