import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Hello from Next.js 15 API',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    return NextResponse.json({
      message: 'POST request received',
      data: body,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }
}
