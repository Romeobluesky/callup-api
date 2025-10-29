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

interface AgentRecord {
  user_id: number
  user_name: string
  user_phone: string | null
  user_status_message: string | null
  is_active: boolean
  last_login_at: string | null
}

interface CreateAgentRequest {
  userName: string
  userPhone: string
}

interface CompanyInfo {
  max_agents: number
}

// GET: 소속 상담원 목록 조회
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

    // Get company info
    const companyInfo = await query<CompanyInfo[]>(
      'SELECT max_agents FROM companies WHERE company_id = ?',
      [user.companyId]
    )

    if (!companyInfo || companyInfo.length === 0) {
      return errorResponse('업체 정보를 찾을 수 없습니다.', 'COMPANY_NOT_FOUND', 404)
    }

    // Get agents list (company_login_id 사용)
    const agents = await query<AgentRecord[]>(
      `SELECT u.user_id, u.user_name, u.user_phone, u.user_status_message, u.is_active, u.last_login_at
       FROM users u
       JOIN companies c ON u.company_login_id = c.company_login_id
       WHERE c.company_id = ?
       ORDER BY u.user_name`,
      [user.companyId]
    )

    const formattedAgents = (agents || []).map((agent) => ({
      userId: agent.user_id,
      userName: agent.user_name,
      userPhone: agent.user_phone || '',
      statusMessage: agent.user_status_message || '',
      isActive: agent.is_active,
      lastLoginAt: agent.last_login_at || '',
    }))

    return successResponse({
      maxAgents: companyInfo[0].max_agents,
      currentAgents: agents.length,
      agents: formattedAgents,
    })
  } catch (error: any) {
    console.error('Get agents error:', error)
    return serverErrorResponse('상담원 목록 조회 중 오류가 발생했습니다.', error)
  }
}

// POST: 상담원 등록
export async function POST(request: NextRequest) {
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

    const body: CreateAgentRequest = await request.json()

    // Validate required fields
    if (!body.userName || !body.userPhone) {
      return errorResponse('userName과 userPhone이 필요합니다.', 'MISSING_FIELDS', 400)
    }

    // Check current agent count
    const agentCountResult = await query<{ current_count: number; max_agents: number }[]>(
      `SELECT COUNT(*) AS current_count, c.max_agents
       FROM users u
       JOIN companies c ON u.company_id = c.company_id
       WHERE u.company_id = ? AND u.is_active = TRUE
       GROUP BY c.max_agents`,
      [user.companyId]
    )

    const { current_count, max_agents } = agentCountResult[0] || { current_count: 0, max_agents: 0 }

    if (current_count >= max_agents) {
      return errorResponse('최대 상담원 수를 초과했습니다.', 'MAX_AGENTS_EXCEEDED', 400)
    }

    // Insert new agent (company_login_id 사용)
    const result: any = await query(
      `INSERT INTO users (company_login_id, user_name, user_phone)
       SELECT company_login_id, ?, ?
       FROM companies
       WHERE company_id = ?`,
      [body.userName, body.userPhone, user.companyId]
    )

    return successResponse(
      {
        userId: result.insertId,
        userName: body.userName,
      },
      '상담원 등록 완료',
      201
    )
  } catch (error: any) {
    console.error('Create agent error:', error)
    return serverErrorResponse('상담원 등록 중 오류가 발생했습니다.', error)
  }
}
