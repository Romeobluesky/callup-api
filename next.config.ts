import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // API 서버로 사용하기 위한 최적화 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
