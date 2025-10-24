import { NextRequest } from 'next/server'
import { query, transaction } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/response'

interface Assignment {
  userId: number
  count: number
}

interface AssignRequest {
  dbId: number
  assignments: Assignment[]
}

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

    const body: AssignRequest = await request.json()

    // Validate input
    if (!body.dbId || !body.assignments || body.assignments.length === 0) {
      return errorResponse('dbId와 assignments가 필요합니다.', 'MISSING_FIELDS', 400)
    }

    // Use transaction for data consistency
    const totalAssigned = await transaction(async (conn) => {
      let totalCount = 0

      // Process each assignment
      for (const assignment of body.assignments) {
        // 1. Get unused customers for this assignment
        const [customers] = await conn.execute<any>(
          `SELECT customer_id
           FROM customers
           WHERE db_id = ? AND data_status = '미사용' AND assigned_user_id IS NULL
           LIMIT ?`,
          [body.dbId, assignment.count]
        )

        if (!customers || customers.length === 0) {
          continue // Skip if no customers available
        }

        const customerIds = customers.map((c: any) => c.customer_id)

        // 2. Assign customers to user
        await conn.execute(
          `UPDATE customers
           SET assigned_user_id = ?
           WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`,
          [assignment.userId, ...customerIds]
        )

        // 3. Update or insert db_assignments
        await conn.execute(
          `INSERT INTO db_assignments (db_id, user_id, company_id, assigned_count)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             assigned_count = assigned_count + ?,
             updated_at = NOW()`,
          [body.dbId, assignment.userId, user.companyId, customers.length, customers.length]
        )

        totalCount += customers.length
      }

      return totalCount
    })

    return successResponse(
      {
        dbId: body.dbId,
        totalAssigned,
      },
      'DB 할당 완료',
      200
    )
  } catch (error: any) {
    console.error('DB assign error:', error)
    return serverErrorResponse('DB 할당 중 오류가 발생했습니다.', error)
  }
}
