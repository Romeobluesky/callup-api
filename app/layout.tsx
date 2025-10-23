export const metadata = {
  title: 'CallUp API',
  description: 'REST API Server built with Next.js 15',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
