import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { generateToken } from '@/lib/jwt'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/response'

interface LoginRequest {
  companyLoginId: string
  companyPassword: string
  userName: string
}

interface CompanyRecord {
  company_id: number
  company_name: string
  max_agents: number
  is_active: boolean
}

interface UserRecord {
  user_id: number
  user_name: string
  user_phone: string | null
  user_status_message: string | null
  is_active: boolean
  last_login_at: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json()

    // Validate input
    if (!body.companyLoginId || !body.companyPassword || !body.userName) {
      return errorResponse('업체 ID, 비밀번호, 상담원 이름을 모두 입력해주세요.', 'MISSING_FIELDS', 400)
    }

    // Step 1: 업체 인증
    const companies = await query<CompanyRecord[]>(
      `SELECT company_id, company_name, max_agents, is_active
       FROM companies
       WHERE company_login_id = ? AND company_password = SHA2(?, 256)`,
      [body.companyLoginId, body.companyPassword]
    )

    // Check if company exists
    if (!companies || companies.length === 0) {
      return errorResponse(
        '업체 ID 또는 비밀번호가 잘못되었습니다.',
        'AUTH_INVALID_CREDENTIALS',
        401
      )
    }

    const company = companies[0]

    // Check if company is active
    if (!company.is_active) {
      return errorResponse('비활성화된 업체입니다. (구독 만료)', 'AUTH_COMPANY_INACTIVE', 403)
    }

    // Step 2: 상담원 조회
    const users = await query<UserRecord[]>(
      `SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
       FROM users
       WHERE company_id = ? AND user_name = ?`,
      [company.company_id, body.userName]
    )

    // Check if user exists
    if (!users || users.length === 0) {
      return errorResponse('해당 이름의 상담원이 없습니다.', 'AUTH_USER_NOT_FOUND', 404)
    }

    const user = users[0]

    // Check if user is active
    if (!user.is_active) {
      return errorResponse('비활성화된 상담원 계정입니다.', 'AUTH_USER_INACTIVE', 403)
    }

    // Step 3: 최종 로그인 시간 업데이트
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE user_id = ?',
      [user.user_id]
    )

    // Step 4: JWT 토큰 생성
    const token = generateToken({
      userId: user.user_id,
      companyId: company.company_id,
      userName: user.user_name,
      role: 'agent',
    })

    // Return success response
    return successResponse(
      {
        token,
        user: {
          userId: user.user_id,
          userName: user.user_name,
          userPhone: user.user_phone || '',
          userStatusMessage: user.user_status_message || '',
          isActive: user.is_active,
          lastLoginAt: new Date().toISOString(),
        },
        company: {
          companyId: company.company_id,
          companyName: company.company_name,
          maxAgents: company.max_agents,
          isActive: company.is_active,
        },
      },
      '로그인 성공',
      200
    )
  } catch (error: any) {
    console.error('Login error:', error)
    return serverErrorResponse('로그인 처리 중 오류가 발생했습니다.', error)
  }
}
