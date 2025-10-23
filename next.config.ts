import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // API 서버로 사용하기 위한 최적화 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // CSV 업로드를 위해 증가
    },
  },

  // TypeScript 및 ESLint 에러 시 빌드 계속 진행
  typescript: {
    ignoreBuildErrors: true, // 타입 에러 무시하고 빌드
  },
  eslint: {
    ignoreDuringBuilds: true, // ESLint 에러 무시
  },
}

export default nextConfig
