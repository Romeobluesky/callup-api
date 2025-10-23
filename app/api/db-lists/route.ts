import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/response'

interface DbListRecord {
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

    // Get search parameter
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let dbLists: DbListRecord[]

    if (search) {
      // Search with title filter
      dbLists = await query<DbListRecord[]>(
        `SELECT
          db_id,
          upload_date,
          file_name,
          total_count,
          unused_count
        FROM db_lists
        WHERE is_active = TRUE
          AND (file_name LIKE ? OR db_title LIKE ?)
        ORDER BY upload_date DESC`,
        [`%${search}%`, `%${search}%`]
      )
    } else {
      // Get all active DB lists
      dbLists = await query<DbListRecord[]>(
        `SELECT
          db_id,
          upload_date,
          file_name,
          total_count,
          unused_count
        FROM db_lists
        WHERE is_active = TRUE
        ORDER BY upload_date DESC`,
        []
      )
    }

    // Format response
    const formattedLists = (dbLists || []).map((db) => ({
      dbId: db.db_id,
      date: db.upload_date,
      title: db.file_name,
      fileName: db.file_name,
      totalCount: db.total_count,
      unusedCount: db.unused_count,
    }))

    return successResponse(formattedLists)
  } catch (error: any) {
    console.error('DB lists error:', error)
    return serverErrorResponse('DB 리스트 조회 중 오류가 발생했습니다.', error)
  }
}
