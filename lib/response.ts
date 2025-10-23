import { NextResponse } from 'next/server'

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
  errorCode?: string
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string, status: number = 200): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
  }

  if (message) {
    response.message = message
  }

  return NextResponse.json(response, { status })
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  errorCode?: string,
  status: number = 400
): NextResponse {
  const response: ApiResponse = {
    success: false,
    message,
  }

  if (errorCode) {
    response.errorCode = errorCode
  }

  return NextResponse.json(response, { status })
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(message: string = '인증이 필요합니다.'): NextResponse {
  return errorResponse(message, 'UNAUTHORIZED', 401)
}

/**
 * Forbidden response
 */
export function forbiddenResponse(message: string = '권한이 없습니다.'): NextResponse {
  return errorResponse(message, 'FORBIDDEN', 403)
}

/**
 * Not found response
 */
export function notFoundResponse(message: string = '리소스를 찾을 수 없습니다.'): NextResponse {
  return errorResponse(message, 'NOT_FOUND', 404)
}

/**
 * Server error response
 */
export function serverErrorResponse(
  message: string = '서버 오류가 발생했습니다.',
  error?: any
): NextResponse {
  console.error('Server error:', error)
  return errorResponse(message, 'INTERNAL_SERVER_ERROR', 500)
}
