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
    console.log('=== Dashboard API Start ===')

    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      console.error('❌ JWT 인증 실패')
      return unauthorizedResponse('인증이 필요합니다.')
    }

    console.log('✅ JWT 인증 성공:', {
      userId: user.userId,
      companyId: user.companyId,
      companyLoginId: user.companyLoginId,
      userName: user.userName,
      role: user.role
    })

    // 1. Get user information (company_login_id 사용)
    console.log('=== Step 1: Users 테이블 조회 ===')
    console.log('Query params:', [user.userId, user.companyLoginId])

    const userInfoResult = await query<UserInfo[]>(
      `SELECT
        user_id,
        user_name,
        user_phone,
        user_status_message,
        is_active,
        last_login_at as updated_at
      FROM users
      WHERE user_id = ? AND company_login_id = ?`,
      [user.userId, user.companyLoginId]
    )

    console.log('Users 조회 결과:', userInfoResult)
    console.log('Users 개수:', userInfoResult?.length)

    if (!userInfoResult || userInfoResult.length === 0) {
      console.error('❌ 사용자 정보 없음')
      return unauthorizedResponse('사용자 정보를 찾을 수 없습니다.')
    }

    const userInfo = userInfoResult[0]
    console.log('✅ User 조회 성공:', userInfo)

    // 2. TODO: Statistics 쿼리 - 테이블 구조 확인 필요
    console.log('=== Step 2: Statistics 조회 (임시 스킵) ===')
    const todayStats = {
      call_count: 0,
      call_duration: '00:00:00',
    }

    // 3. TODO: Call Results 쿼리 - 테이블 구조 확인 필요
    console.log('=== Step 3: Call Results 조회 (임시 스킵) ===')
    const callResults = {
      connected: 0,
      failed: 0,
      callback: 0,
    }

    // 4. Get DB lists (최근 3개) - 상담원에게 분배된 고객만 카운트
    console.log('=== Step 4: DB Lists 조회 ===')
    console.log('Query params:', [user.userId, user.companyLoginId])

    const dbListsResult = await query<DbList[]>(
      `SELECT
        dl.db_id,
        dl.db_date as upload_date,
        dl.db_title as file_name,
        COUNT(c.customer_id) AS total_count,
        COUNT(CASE WHEN c.data_status = '미사용' THEN 1 END) AS unused_count
      FROM db_lists dl
      LEFT JOIN customers c ON c.db_id = dl.db_id AND c.assigned_user_id = ?
      WHERE dl.company_login_id = ? AND dl.is_active = TRUE
      GROUP BY dl.db_id, dl.db_date, dl.db_title
      ORDER BY dl.db_date DESC
      LIMIT 3`,
      [user.userId, user.companyLoginId]
    )

    console.log('DB Lists 조회 결과:', dbListsResult)
    console.log('DB Lists 개수:', dbListsResult?.length)

    const dbLists =
      dbListsResult?.map((db) => ({
        dbId: db.db_id,
        date: db.upload_date,
        title: db.file_name,
        totalCount: db.total_count,
        unusedCount: db.unused_count,
      })) || []

    // Return dashboard data (필드명 통일: userPhone, userStatusMessage)
    console.log('=== Step 5: 응답 생성 ===')
    return successResponse({
      user: {
        userId: userInfo.user_id,
        userName: userInfo.user_name,
        userPhone: userInfo.user_phone || '',
        userStatusMessage: userInfo.user_status_message || '',
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
    console.error('=== Dashboard API Error ===')
    console.error('Error Type:', error?.constructor?.name)
    console.error('Error Message:', error?.message)
    console.error('Error Code:', error?.code)
    console.error('Error SQL:', error?.sql)
    console.error('Error Stack:', error?.stack)
    return serverErrorResponse('대시보드 조회 중 오류가 발생했습니다.', error)
  }
}
