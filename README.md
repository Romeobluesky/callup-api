# CallUp API

Next.js 15 기반 REST API 서버

## 기술 스택

- Next.js 15
- TypeScript
- React 19
- MySQL 8.0
- MySQL2 (Node.js MySQL driver)

## 시작하기

### 환경 설정

1. `.env.example` 파일을 복사하여 `.env` 파일 생성

```bash
cp .env.example .env
```

2. `.env` 파일에 데이터베이스 정보 입력

```env
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=call_db
```

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

서버가 [http://localhost:3000](http://localhost:3000) 에서 실행됩니다.

### 빌드

```bash
npm run build
```

### 프로덕션 실행

```bash
npm start
```

## API 엔드포인트

### GET /api/hello

헬로 월드 API

**응답 예시:**

```json
{
  "message": "Hello from Next.js 15 API",
  "timestamp": "2025-10-23T04:09:00.000Z"
}
```

### POST /api/hello

POST 요청 테스트

**요청 예시:**

```bash
curl -X POST http://localhost:3000/api/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 123}'
```

**응답 예시:**

```json
{
  "message": "POST request received",
  "data": {
    "name": "test",
    "value": 123
  },
  "timestamp": "2025-10-23T04:09:00.000Z"
}
```

### GET /api/db/test

데이터베이스 연결 테스트

**응답 예시:**

```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "connected": true,
    "version": "8.0.x",
    "database": "call_db",
    "timestamp": "2025-10-23T04:09:00.000Z"
  }
}
```

## 프로젝트 구조

```
callup-api/
├── app/
│   ├── api/
│   │   ├── hello/
│   │   │   └── route.ts      # Hello API 라우트
│   │   └── db/
│   │       └── test/
│   │           └── route.ts  # DB 연결 테스트 API
│   ├── layout.tsx            # 루트 레이아웃
│   └── page.tsx              # 홈 페이지
├── lib/
│   └── db.ts                 # MySQL 데이터베이스 유틸리티
├── .env                      # 환경 변수 (실서버 설정)
├── .env.local                # 환경 변수 (로컬 개발용)
├── .env.example              # 환경 변수 예시
├── next.config.ts            # Next.js 설정
├── tsconfig.json             # TypeScript 설정
└── package.json              # 프로젝트 의존성
```

## 개발 가이드

### 새로운 API 엔드포인트 추가

1. `app/api/` 디렉토리에 새 폴더 생성
2. `route.ts` 파일 생성
3. HTTP 메서드에 맞는 함수 export (GET, POST, PUT, DELETE 등)

**기본 예시:**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Success' })
}
```

### 데이터베이스 사용 예시

**간단한 쿼리:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const users = await query('SELECT * FROM users LIMIT 10')
    return NextResponse.json({ success: true, data: users })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

**트랜잭션 사용:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { transaction } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const result = await transaction(async (connection) => {
      await connection.execute('INSERT INTO users (name) VALUES (?)', ['John'])
      await connection.execute('INSERT INTO logs (action) VALUES (?)', ['user_created'])
      return { success: true }
    })
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

## 데이터베이스 유틸리티 함수

### `query(sql, params)`
- 단순 쿼리 실행
- 자동 연결 관리
- Promise 기반

### `transaction(callback)`
- 트랜잭션 처리
- 자동 커밋/롤백
- 에러 시 자동 롤백

### `testConnection()`
- 데이터베이스 연결 테스트
- 헬스체크용

### `getConnection()`
- 커넥션 풀에서 연결 가져오기
- 수동 연결 관리가 필요한 경우

## 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `NODE_ENV` | 실행 환경 | development |
| `PORT` | 서버 포트 | 3000 |
| `DB_HOST` | 데이터베이스 호스트 | localhost |
| `DB_PORT` | 데이터베이스 포트 | 3306 |
| `DB_USER` | 데이터베이스 사용자 | root |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | - |
| `DB_NAME` | 데이터베이스 이름 | call_db |
| `DB_CONNECTION_LIMIT` | 커넥션 풀 최대 연결 수 | 10 |
| `DB_QUEUE_LIMIT` | 대기열 제한 | 0 |
| `DB_WAIT_FOR_CONNECTIONS` | 연결 대기 여부 | true |

## 라이선스

ISC
