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
      // Search with title filter
      dbLists = await query<DbListRecord[]>(
        `SELECT
          db_id,
          company_id,
          db_date,
          db_title,
          total_count,
          unused_count,
          is_active
        FROM db_lists
        WHERE company_id = ?
          AND db_title LIKE ?
        ORDER BY db_date DESC`,
        [user.companyId, `%${search}%`]
      )
    } else {
      // Get all DB lists for company
      dbLists = await query<DbListRecord[]>(
        `SELECT
          db_id,
          company_id,
          db_date,
          db_title,
          total_count,
          unused_count,
          is_active
        FROM db_lists
        WHERE company_id = ?
        ORDER BY db_date DESC`,
        [user.companyId]
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
