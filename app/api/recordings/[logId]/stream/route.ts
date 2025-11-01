import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
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
      'SELECT log_id, has_audio, audio_file_path, audio_format FROM call_logs WHERE log_id = ?',
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

    // Get file stats
    const fileStats = await stat(filePath)

    // Read file
    const fileBuffer = await readFile(filePath)

    // Determine content type
    const format = recording.audio_format || 'm4a'
    const contentTypeMap: { [key: string]: string } = {
      m4a: 'audio/mp4',
      mp3: 'audio/mpeg',
      amr: 'audio/amr',
    }
    const contentType = contentTypeMap[format] || 'audio/mp4'

    // Return file with streaming headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStats.size.toString(),
        'Content-Disposition': 'inline',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error: any) {
    console.error('Stream recording error:', error)
    return serverErrorResponse('녹취파일 스트리밍 중 오류가 발생했습니다.', error)
  }
}
