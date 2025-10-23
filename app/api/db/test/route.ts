import { NextRequest, NextResponse } from 'next/server'
import { testConnection, query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Test connection
    const isConnected = await testConnection()

    if (!isConnected) {
      return NextResponse.json(
        {
          success: false,
          message: 'Database connection failed',
        },
        { status: 500 }
      )
    }

    // Test query - Get database version and current database
    const result = await query<any[]>('SELECT VERSION() as version, DATABASE() as current_db')

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: {
        connected: true,
        version: result[0]?.version || 'unknown',
        database: result[0]?.current_db || 'unknown',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Database test error:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Database test failed',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
