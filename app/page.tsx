export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>CallUp API Server</h1>
      <p>Next.js 15 REST API가 정상적으로 실행 중입니다.</p>

      <div style={{ marginTop: '2rem' }}>
        <h2>사용 가능한 엔드포인트:</h2>
        <ul>
          <li>
            <code>GET /api/hello</code> - 헬로 월드 API
          </li>
          <li>
            <code>POST /api/hello</code> - POST 요청 테스트
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
        <h3>테스트 방법:</h3>
        <pre style={{ background: '#fff', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`# GET 요청
curl http://localhost:3000/api/hello

# POST 요청
curl -X POST http://localhost:3000/api/hello \\
  -H "Content-Type: application/json" \\
  -d '{"name": "test"}'`}
        </pre>
      </div>
    </div>
  )
}
