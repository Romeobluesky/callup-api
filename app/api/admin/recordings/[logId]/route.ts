import { NextRequest } from 'next/server'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/response'

interface RecordingRecord {
  log_id: number
  has_audio: boolean
  audio_file_path: string | null
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    // Check company admin or super admin role
    if (user.role !== 'company_admin' && user.role !== 'super_admin') {
      return forbiddenResponse('관리자 권한이 필요합니다.')
    }

    const { logId } = await params
    const logIdNum = parseInt(logId)

    // Get recording info
    const recordings = await query<RecordingRecord[]>(
      'SELECT log_id, has_audio, audio_file_path FROM call_logs WHERE log_id = ? AND company_id = ?',
      [logIdNum, user.companyId]
    )

    if (!recordings || recordings.length === 0) {
      return notFoundResponse('녹취파일을 찾을 수 없습니다.')
    }

    const recording = recordings[0]

    // Delete file from filesystem if exists
    if (recording.has_audio && recording.audio_file_path) {
      const filePath = path.join(process.cwd(), recording.audio_file_path)

      if (existsSync(filePath)) {
        await unlink(filePath)
      }
    }

    // Update database
    await query(
      `UPDATE call_logs
       SET has_audio = FALSE,
           audio_file_path = NULL,
           audio_file_size = NULL,
           audio_duration = NULL,
           audio_format = NULL,
           original_filename = NULL,
           uploaded_at = NULL,
           upload_status = 'pending'
       WHERE log_id = ?`,
      [logIdNum]
    )

    return successResponse(
      {
        logId: logIdNum,
        deleted: true,
      },
      '녹취파일이 삭제되었습니다.',
      200
    )
  } catch (error: any) {
    console.error('Delete recording error:', error)
    return serverErrorResponse('녹취파일 삭제 중 오류가 발생했습니다.', error)
  }
}
