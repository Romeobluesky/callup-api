import { NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/response'

interface RecordingRecord {
  log_id: number
  has_audio: boolean
  uploaded_at: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    // Authenticate user
    const user = authenticate(request)

    if (!user) {
      return unauthorizedResponse('인증이 필요합니다.')
    }

    const { logId } = await params
    const logIdNum = parseInt(logId)

    // Check if recording exists
    const recordings = await query<RecordingRecord[]>(
      'SELECT log_id, has_audio, uploaded_at FROM call_logs WHERE log_id = ?',
      [logIdNum]
    )

    if (!recordings || recordings.length === 0) {
      return successResponse({
        exists: false,
        logId: logIdNum,
        uploadedAt: null,
      })
    }

    const recording = recordings[0]

    return successResponse({
      exists: recording.has_audio,
      logId: recording.log_id,
      uploadedAt: recording.uploaded_at ? new Date(recording.uploaded_at).toISOString() : null,
    })
  } catch (error: any) {
    console.error('Check recording exists error:', error)
    return serverErrorResponse('녹취파일 존재 여부 확인 중 오류가 발생했습니다.', error)
  }
}
