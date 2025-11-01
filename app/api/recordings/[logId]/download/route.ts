import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { query } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/response'

interface RecordingRecord {
  log_id: number
  has_audio: boolean
  audio_file_path: string | null
  audio_format: string | null
  original_filename: string | null
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

    // Get recording info
    const recordings = await query<RecordingRecord[]>(
      'SELECT log_id, has_audio, audio_file_path, audio_format, original_filename FROM call_logs WHERE log_id = ?',
      [logIdNum]
    )

    if (!recordings || recordings.length === 0 || !recordings[0].has_audio) {
      return notFoundResponse('녹취파일을 찾을 수 없습니다.')
    }

    const recording = recordings[0]
    const filePath = path.join(process.cwd(), recording.audio_file_path || '')

    // Check if file exists
    if (!existsSync(filePath)) {
      return notFoundResponse('녹취파일이 존재하지 않습니다.')
    }

    // Read file
    const fileBuffer = await readFile(filePath)

    // Generate download filename
    const format = recording.audio_format || 'm4a'
    const downloadFilename =
      recording.original_filename || `recording_${logIdNum}.${format}`

    // Return file for download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Download recording error:', error)
    return serverErrorResponse('녹취파일 다운로드 중 오류가 발생했습니다.', error)
  }
}
