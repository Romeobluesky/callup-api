import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/response'

interface DbListRecord {
  db_id: number
  company_id: number
  db_date: string
  db_title: string
  total_count: number
  unused_count: number
  is_active: boolean
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Get search parameter
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let dbLists: DbListRecord[]

    if (search) {
      // Search with title filter - 상담원에게 분배된 고객만 카운트
      dbLists = await query<DbListRecord[]>(
        `SELECT
          dl.db_id,
          dl.company_id,
          dl.db_date,
          dl.db_title,
          COUNT(c.customer_id) AS total_count,
          COUNT(CASE WHEN c.data_status = '미사용' THEN 1 END) AS unused_count,
          dl.is_active
        FROM db_lists dl
        LEFT JOIN customers c ON c.db_id = dl.db_id AND c.assigned_user_id = ?
        WHERE dl.company_login_id = ?
          AND dl.db_title LIKE ?
        GROUP BY dl.db_id, dl.company_id, dl.db_date, dl.db_title, dl.is_active
        ORDER BY dl.db_date DESC`,
        [user.userId, user.companyLoginId, `%${search}%`]
      )
    } else {
      // Get all DB lists for company - 상담원에게 분배된 고객만 카운트
      dbLists = await query<DbListRecord[]>(
        `SELECT
          dl.db_id,
          dl.company_id,
          dl.db_date,
          dl.db_title,
          COUNT(c.customer_id) AS total_count,
          COUNT(CASE WHEN c.data_status = '미사용' THEN 1 END) AS unused_count,
          dl.is_active
        FROM db_lists dl
        LEFT JOIN customers c ON c.db_id = dl.db_id AND c.assigned_user_id = ?
        WHERE dl.company_login_id = ?
        GROUP BY dl.db_id, dl.company_id, dl.db_date, dl.db_title, dl.is_active
        ORDER BY dl.db_date DESC`,
        [user.userId, user.companyLoginId]
      )
    }

    // Format response
    const formattedLists = (dbLists || []).map((db) => ({
      dbId: db.db_id,
      companyId: db.company_id,
      date: db.db_date,
      title: db.db_title,
      total: db.total_count,
      unused: db.unused_count,
      isActive: db.is_active,
    }))

    return successResponse(formattedLists)
  } catch (error: any) {
    console.error('DB lists error:', error)
    return serverErrorResponse('DB 리스트 조회 중 오류가 발생했습니다.', error)
  }
}
