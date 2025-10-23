import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { generateToken } from '@/lib/jwt'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/response'

interface LoginRequest {
  userId: string
  userName: string
  password: string
}

interface UserRecord {
  user_id: number
  user_login_id: string
  user_name: string
  user_password: string
  user_phone: string | null
  user_status_message: string | null
  is_active: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json()

    // Validate input
    if (!body.userId || !body.userName || !body.password) {
      return errorResponse('아이디, 이름, 비밀번호를 모두 입력해주세요.', 'MISSING_FIELDS', 400)
    }

    // Query user from database
    const users = await query<UserRecord[]>(
      `SELECT
        user_id,
        user_login_id,
        user_name,
        user_password,
        user_phone,
        user_status_message,
        is_active
      FROM users
      WHERE user_login_id = ? AND user_name = ?`,
      [body.userId, body.userName]
    )

    // Check if user exists
    if (!users || users.length === 0) {
      return errorResponse(
        '아이디 또는 이름이 일치하지 않습니다.',
        'INVALID_CREDENTIALS',
        401
      )
    }

    const user = users[0]

    // Verify password
    const isPasswordValid = await bcrypt.compare(body.password, user.user_password)

    if (!isPasswordValid) {
      return errorResponse('비밀번호가 일치하지 않습니다.', 'INVALID_CREDENTIALS', 401)
    }

    // Check if user is active
    if (!user.is_active) {
      return errorResponse('비활성화된 계정입니다.', 'INACTIVE_USER', 403)
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id,
      userLoginId: user.user_login_id,
      userName: user.user_name,
    })

    // Return success response
    return successResponse(
      {
        token,
        user: {
          id: user.user_id,
          userId: user.user_login_id,
          userName: user.user_name,
          phone: user.user_phone || '',
          statusMessage: user.user_status_message || '',
          isActive: user.is_active,
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
