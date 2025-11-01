import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/response'

interface CallLogRecord {
  log_id: number
  company_id: number
  user_id: number
  customer_id: number
  call_datetime: string
}

interface CustomerRecord {
  customer_id: number
  company_id: number
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const phoneNumber = formData.get('phoneNumber') as string
    const recordedAt = formData.get('recordedAt') as string
    const duration = parseInt(formData.get('duration') as string || '0')

    // Validate required fields
    if (!file || !phoneNumber || !recordedAt) {
      return errorResponse('필수 정보가 누락되었습니다.', 'MISSING_FIELDS', 400)
    }

    // Validate file type - added 3gp, wav, aac formats
    const allowedMimeTypes = [
      'audio/m4a', 'audio/mp4', 'audio/x-m4a',
      'audio/mpeg', 'audio/mp3',
      'audio/amr',
      'audio/3gpp', 'audio/3gp',
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/aac', 'audio/x-aac'
    ]
    if (!allowedMimeTypes.includes(file.type)) {
      return errorResponse(
        '지원하지 않는 파일 형식입니다. (m4a, mp3, amr, 3gp, wav, aac만 허용)',
        'INVALID_FILE_TYPE',
        400
      )
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: '파일 크기는 50MB를 초과할 수 없습니다.',
          code: 'FILE_TOO_LARGE'
        }),
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse recordedAt timestamp
    const recordedAtDate = new Date(recordedAt)
    if (isNaN(recordedAtDate.getTime())) {
      return errorResponse('녹음 시간 형식이 올바르지 않습니다.', 'INVALID_TIMESTAMP', 400)
    }

    // Find call_log by phone number and timestamp (within 5 minutes tolerance)
    const toleranceMinutes = 5
    const startTime = new Date(recordedAtDate.getTime() - toleranceMinutes * 60 * 1000)
    const endTime = new Date(recordedAtDate.getTime() + toleranceMinutes * 60 * 1000)

    const callLogs = await query<CallLogRecord[]>(
      `SELECT log_id, company_id, user_id, customer_id, call_datetime
       FROM call_logs
       WHERE company_id = ?
         AND (caller_phone = ? OR receiver_phone = ?)
         AND call_datetime BETWEEN ? AND ?
       ORDER BY ABS(TIMESTAMPDIFF(SECOND, call_datetime, ?)) ASC
       LIMIT 1`,
      [user.companyId, phoneNumber, phoneNumber, startTime, endTime, recordedAtDate]
    )

    let callLog: CallLogRecord | null = null
    let customerId: number | null = null

    if (callLogs && callLogs.length > 0) {
      callLog = callLogs[0]
      customerId = callLog.customer_id
    } else {
      // If no call_log found, try to find customer by phone number
      const customers = await query<CustomerRecord[]>(
        'SELECT customer_id, company_id FROM customers WHERE company_id = ? AND customer_phone = ? LIMIT 1',
        [user.companyId, phoneNumber]
      )

      if (customers && customers.length > 0) {
        customerId = customers[0].customer_id
      } else {
        return errorResponse(
          '해당 전화번호로 통화 기록 또는 고객 정보를 찾을 수 없습니다.',
          'NOT_FOUND',
          404
        )
      }
    }

    // Check if recording already exists for this call_log
    if (callLog) {
      const existingRecordings = await query<{ has_audio: boolean }[]>(
        'SELECT has_audio FROM call_logs WHERE log_id = ? AND has_audio = TRUE',
        [callLog.log_id]
      )

      if (existingRecordings && existingRecordings.length > 0) {
        return errorResponse('이미 녹취파일이 업로드되어 있습니다.', 'ALREADY_UPLOADED', 400)
      }
    }

    // Generate file path
    const yearMonth = recordedAtDate.toISOString().slice(0, 7) // YYYY-MM
    const dateString = recordedAtDate.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const timestamp = recordedAtDate.toISOString().replace(/[-:]/g, '').slice(0, 14) // YYYYMMDDHHmmss

    const fileExtension = file.name.split('.').pop() || 'm4a'
    const cleanPhone = phoneNumber.replace(/-/g, '')
    const filename = callLog
      ? `${cleanPhone}_${timestamp}_${callLog.log_id}.${fileExtension}`
      : `${cleanPhone}_${timestamp}.${fileExtension}`

    const storageDir = path.join(process.cwd(), 'storage', 'recordings', `company_${user.companyId}`, yearMonth, dateString)
    const relativePath = path.join('storage', 'recordings', `company_${user.companyId}`, yearMonth, dateString, filename)
    const absolutePath = path.join(process.cwd(), relativePath)

    // Create directory if not exists
    if (!existsSync(storageDir)) {
      await mkdir(storageDir, { recursive: true })
    }

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(absolutePath, buffer)

    // Update call_logs table if call_log exists
    if (callLog) {
      await query(
        `UPDATE call_logs
         SET has_audio = TRUE,
             audio_file_path = ?,
             audio_file_size = ?,
             audio_duration = ?,
             audio_format = ?,
             original_filename = ?,
             uploaded_at = NOW(),
             upload_status = 'completed'
         WHERE log_id = ?`,
        [relativePath, file.size, duration, fileExtension, file.name, callLog.log_id]
      )
    }

    // Update customers table
    if (customerId) {
      await query(
        `UPDATE customers
         SET has_audio = TRUE,
             audio_file_path = ?
         WHERE customer_id = ?`,
        [relativePath, customerId]
      )
    }

    return successResponse(
      {
        phoneNumber,
        recordedAt,
        fileName: filename,
        fileSize: file.size,
        duration,
        uploadedAt: new Date().toISOString(),
      },
      '녹취파일 업로드 완료',
      200
    )
  } catch (error: any) {
    console.error('Recording upload error:', error)
    return serverErrorResponse('녹취파일 업로드 중 오류가 발생했습니다.', error)
  }
}
