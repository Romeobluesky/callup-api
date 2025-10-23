import { NextRequest } from 'next/server'
import { query, transaction } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'
import * as iconv from 'iconv-lite'

interface CustomerRow {
  eventName: string
  phone: string
  name: string
  info1: string
  info2: string
  info3: string
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string

    if (!file) {
      return errorResponse('파일이 필요합니다.', 'MISSING_FILE', 400)
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return errorResponse('CSV 파일만 업로드 가능합니다.', 'INVALID_FILE_TYPE', 400)
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Convert from EUC-KR to UTF-8
    let csvContent: string
    try {
      csvContent = iconv.decode(buffer, 'euc-kr')
    } catch (error) {
      // If EUC-KR fails, try UTF-8
      csvContent = buffer.toString('utf-8')
    }

    // Parse CSV content
    const lines = csvContent.split('\n').filter((line) => line.trim())

    if (lines.length < 2) {
      return errorResponse('CSV 파일에 데이터가 없습니다.', 'EMPTY_FILE', 400)
    }

    // Skip header row and parse data rows
    const customers: CustomerRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Split by comma (handle quoted fields)
      const columns = line.split(',').map((col) => col.trim().replace(/^"|"$/g, ''))

      if (columns.length < 3) continue // Need at least eventName, phone, name

      customers.push({
        eventName: columns[0] || '',
        phone: columns[1] || '',
        name: columns[2] || '',
        info1: columns[3] || '',
        info2: columns[4] || '',
        info3: columns[5] || '',
      })
    }

    if (customers.length === 0) {
      return errorResponse('유효한 고객 데이터가 없습니다.', 'NO_VALID_DATA', 400)
    }

    // Use transaction to insert data
    const result = await transaction(async (connection) => {
      // 1. Insert DB list metadata
      const fileName = title || file.name
      const totalCount = customers.length
      const unusedCount = customers.length

      const [dbListResult] = await connection.execute(
        `INSERT INTO db_lists (
          db_title,
          db_date,
          file_name,
          upload_date,
          total_count,
          unused_count,
          is_active
        ) VALUES (?, CURDATE(), ?, CURDATE(), ?, ?, TRUE)`,
        [fileName, fileName, totalCount, unusedCount]
      )

      const insertResult = dbListResult as any
      const dbId = insertResult.insertId

      // 2. Bulk insert customers
      const customerValues: any[] = []
      const placeholders: string[] = []

      for (const customer of customers) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, CURDATE())')
        customerValues.push(
          dbId,
          customer.eventName,
          customer.phone,
          customer.name,
          customer.info1,
          customer.info2,
          customer.info3,
          '미사용'
        )
      }

      await connection.execute(
        `INSERT INTO customers (
          db_id,
          event_name,
          customer_phone,
          customer_name,
          customer_info1,
          customer_info2,
          customer_info3,
          data_status,
          upload_date
        ) VALUES ${placeholders.join(', ')}`,
        customerValues
      )

      return {
        dbId,
        fileName,
        totalCount,
      }
    })

    return successResponse(
      {
        dbId: result.dbId,
        fileName: result.fileName,
        totalCount: result.totalCount,
        uploadDate: new Date().toISOString().split('T')[0],
      },
      'CSV 파일이 업로드되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('CSV upload error:', error)
    return serverErrorResponse('CSV 업로드 중 오류가 발생했습니다.', error)
  }
}
