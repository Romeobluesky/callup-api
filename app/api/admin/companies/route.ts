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

interface CompanyRecord {
  company_id: number
  company_login_id: string
  company_name: string
  max_agents: number
  current_agents: number
  is_active: boolean
  subscription_start_date: string | null
  subscription_end_date: string | null
  admin_name: string | null
  admin_phone: string | null
  admin_email: string | null
  created_at: string
}

interface CreateCompanyRequest {
  companyLoginId: string
  companyPassword: string
  companyName: string
  maxAgents: number
  subscriptionStartDate: string
  subscriptionEndDate: string
  adminName: string
  adminPhone: string
  adminEmail: string
}

// GET: 전체 업체 목록 조회
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Check super admin role
    if (user.role !== 'super_admin') {
      return forbiddenResponse('슈퍼 관리자 권한이 필요합니다.')
    }

    // Get all companies with agent counts
    const companies = await query<CompanyRecord[]>(
      `SELECT
        c.company_id,
        c.company_login_id,
        c.company_name,
        c.max_agents,
        COUNT(u.user_id) AS current_agents,
        c.is_active,
        c.subscription_start_date,
        c.subscription_end_date,
        c.admin_name,
        c.admin_phone,
        c.admin_email,
        c.created_at
      FROM companies c
      LEFT JOIN users u ON c.company_id = u.company_id AND u.is_active = TRUE
      GROUP BY c.company_id
      ORDER BY c.created_at DESC`,
      []
    )

    // Format response
    const formattedCompanies = (companies || []).map((company) => ({
      companyId: company.company_id,
      companyLoginId: company.company_login_id,
      companyName: company.company_name,
      maxAgents: company.max_agents,
      currentAgents: company.current_agents,
      isActive: company.is_active,
      subscriptionStartDate: company.subscription_start_date || '',
      subscriptionEndDate: company.subscription_end_date || '',
      adminName: company.admin_name || '',
      adminPhone: company.admin_phone || '',
      adminEmail: company.admin_email || '',
      createdAt: company.created_at,
    }))

    return successResponse(formattedCompanies)
  } catch (error: any) {
    console.error('Get companies error:', error)
    return serverErrorResponse('업체 목록 조회 중 오류가 발생했습니다.', error)
  }
}

// POST: 업체 등록
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Check super admin role
    if (user.role !== 'super_admin') {
      return forbiddenResponse('슈퍼 관리자 권한이 필요합니다.')
    }

    const body: CreateCompanyRequest = await request.json()

    // Validate required fields
    if (
      !body.companyLoginId ||
      !body.companyPassword ||
      !body.companyName ||
      !body.maxAgents ||
      !body.subscriptionStartDate ||
      !body.subscriptionEndDate
    ) {
      return errorResponse('필수 필드가 누락되었습니다.', 'MISSING_FIELDS', 400)
    }

    // Insert new company
    const result: any = await query(
      `INSERT INTO companies (
        company_login_id, company_password, company_name, max_agents,
        subscription_start_date, subscription_end_date,
        admin_name, admin_phone, admin_email
      ) VALUES (?, SHA2(?, 256), ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.companyLoginId,
        body.companyPassword,
        body.companyName,
        body.maxAgents,
        body.subscriptionStartDate,
        body.subscriptionEndDate,
        body.adminName || null,
        body.adminPhone || null,
        body.adminEmail || null,
      ]
    )

    return successResponse(
      {
        companyId: result.insertId,
        companyLoginId: body.companyLoginId,
      },
      '업체 등록 완료',
      201
    )
  } catch (error: any) {
    console.error('Create company error:', error)

    // Check for duplicate entry
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse('이미 존재하는 업체 ID입니다.', 'DUPLICATE_COMPANY_ID', 409)
    }

    return serverErrorResponse('업체 등록 중 오류가 발생했습니다.', error)
  }
}
