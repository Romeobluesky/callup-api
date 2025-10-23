# CallUp API Server

CallUp 모바일 자동 통화 애플리케이션을 위한 RESTful API 서버입니다.

## 🚀 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: MySQL 8.0+
- **Authentication**: JWT (JSON Web Token)
- **Password Hashing**: bcryptjs
- **Runtime**: Node.js 18+

---

## 📋 주요 기능

### 1. 인증 시스템
- JWT 기반 로그인
- 토큰 기반 API 인증
- 비밀번호 bcrypt 해싱

### 2. 대시보드
- 사용자 정보 조회
- 오늘의 통화 통계
- 통화 결과 집계
- 최근 DB 리스트

### 3. DB 관리
- CSV 파일 업로드 (EUC-KR/UTF-8 지원)
- DB 리스트 조회
- 고객 목록 조회 (페이지네이션)

### 4. 자동 통화
- 다음 미사용 고객 조회
- 통화 결과 저장
- 통계 자동 업데이트

### 5. 고객 관리
- 고객 검색 (이름, 전화번호, 이벤트명, 통화결과)
- 고객 상세 정보 조회

### 6. 통계
- 기간별 통화 통계 (오늘/주간/월간/전체)
- 통화 결과 집계
- DB 사용 현황

---

## 🔧 환경 설정

### 1. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일 내용:

```env
# API Configuration
NODE_ENV=production
PORT=3000
API_URL=https://api.autocallup.com

# Database Configuration
DB_HOST=1.234.2.37
DB_PORT=3306
DB_USER=callup_user
DB_PASSWORD=your_secure_password
DB_NAME=callup_db
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_WAIT_FOR_CONNECTIONS=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=*
```

### 2. 데이터베이스 설정

MySQL 데이터베이스 생성 및 스키마 적용:

```sql
-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS callup_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 사용자 생성
CREATE USER 'callup_user'@'%' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON callup_db.* TO 'callup_user'@'%';
FLUSH PRIVILEGES;
```

스키마 파일 실행:
```bash
mysql -h 1.234.2.37 -u callup_user -p callup_db < .claude/DATABASE_SCHEMA.md
```

---

## 🚀 설치 및 실행

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

서버가 [http://localhost:3000](http://localhost:3000) 에서 실행됩니다.

### 프로덕션 환경

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

### PM2 배포

```bash
# PM2로 실행
pm2 start ecosystem.config.js

# 상태 확인
pm2 status

# 로그 확인
pm2 logs callup-api
```

---

## 📚 API 엔드포인트

### Base URL
```
https://api.autocallup.com
```

### 인증
대부분의 엔드포인트는 JWT 토큰이 필요합니다:
```
Authorization: Bearer <JWT_TOKEN>
```

### 주요 엔드포인트

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|-----------|------|------|
| POST | `/api/auth/login` | 로그인 | ❌ |
| GET | `/api/dashboard` | 대시보드 데이터 | ✅ |
| PATCH | `/api/users/status` | 사용자 상태 업데이트 | ✅ |
| GET | `/api/db-lists` | DB 리스트 조회 | ✅ |
| GET | `/api/db-lists/:dbId/customers` | 고객 목록 조회 | ✅ |
| POST | `/api/db-lists/upload` | CSV 업로드 | ✅ |
| GET | `/api/auto-call/next-customer` | 다음 고객 조회 | ✅ |
| POST | `/api/call-logs` | 통화 결과 저장 | ✅ |
| GET | `/api/customers/search` | 고객 검색 | ✅ |
| GET | `/api/customers/:customerId` | 고객 상세 조회 | ✅ |
| GET | `/api/statistics` | 통계 조회 | ✅ |
| GET | `/api/db/test` | DB 연결 테스트 | ❌ |

**상세 API 문서**: [API_ENDPOINTS.md](./API_ENDPOINTS.md)

---

## 📁 프로젝트 구조

```
callup-api/
├── app/
│   └── api/                    # API 라우트
│       ├── auth/              # 인증 API
│       ├── dashboard/         # 대시보드 API
│       ├── users/             # 사용자 API
│       ├── db-lists/          # DB 리스트 API
│       ├── auto-call/         # 자동 통화 API
│       ├── call-logs/         # 통화 기록 API
│       ├── customers/         # 고객 API
│       ├── statistics/        # 통계 API
│       └── db/test/           # DB 테스트
├── lib/
│   ├── auth.ts               # 인증 헬퍼
│   ├── db.ts                 # DB 연결 및 쿼리
│   ├── jwt.ts                # JWT 유틸리티
│   └── response.ts           # API 응답 헬퍼
├── middleware.ts             # CORS 미들웨어
├── ecosystem.config.js       # PM2 설정
└── .env                      # 환경 변수
```

**상세 구조**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

---

## 🧪 테스트

### 데이터베이스 연결 테스트
```bash
curl http://localhost:3000/api/db/test
```

### 로그인 테스트
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "admin01",
    "userName": "김상담",
    "password": "password123"
  }'
```

### 대시보드 테스트 (JWT 필요)
```bash
curl -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📦 배포

### Nginx 설정

```nginx
server {
    listen 80;
    server_name api.autocallup.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL 설정 (Let's Encrypt)
```bash
sudo certbot --nginx -d api.autocallup.com
```

**상세 배포 가이드**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🔒 보안

1. **JWT Secret**: 32자 이상의 강력한 시크릿 키 사용
2. **비밀번호**: bcrypt 해싱 (cost factor: 10)
3. **SQL Injection**: Prepared Statements 사용
4. **CORS**: 프로덕션에서 특정 도메인만 허용
5. **HTTPS**: SSL 인증서 필수 사용

---

## ⚡ 성능 최적화

1. **Connection Pool**: MySQL 연결 풀 사용 (기본 10개)
2. **트랜잭션**: 여러 쿼리를 하나의 트랜잭션으로 처리
3. **인덱스**: 주요 컬럼에 인덱스 설정
4. **페이지네이션**: 대용량 데이터 조회 시 페이지네이션 적용
5. **벌크 인서트**: CSV 업로드 시 벌크 인서트 사용

---

## 📖 문서

- **API 엔드포인트**: [API_ENDPOINTS.md](./API_ENDPOINTS.md)
- **배포 가이드**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **프로젝트 구조**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **데이터베이스 스키마**: [.claude/DATABASE_SCHEMA.md](./.claude/DATABASE_SCHEMA.md)
- **API 서버 사양**: [.claude/API_SERVER_SPEC.md](./.claude/API_SERVER_SPEC.md)

---

## 🛠️ 개발 가이드

### 새로운 API 엔드포인트 추가

1. `app/api/` 디렉토리에 새 폴더 생성
2. `route.ts` 파일 생성
3. HTTP 메서드 함수 export

```typescript
import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/response'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = authenticate(request)

  if (!user) {
    return unauthorizedResponse()
  }

  const data = await query('SELECT * FROM table WHERE user_id = ?', [user.userId])

  return successResponse(data)
}
```

---

## 🤝 Flutter 앱 연동

```dart
// API Base URL
const String apiBaseUrl = 'https://api.autocallup.com';

// 로그인
final response = await http.post(
  Uri.parse('$apiBaseUrl/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'userId': 'admin01',
    'userName': '김상담',
    'password': 'password123',
  }),
);

// JWT 토큰 저장
final token = jsonDecode(response.body)['data']['token'];

// 인증 API 호출
final dashboardResponse = await http.get(
  Uri.parse('$apiBaseUrl/api/dashboard'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  },
);
```

---

## 📝 라이선스

ISC

---

## 📧 문의

- **Repository**: https://github.com/Romeobluesky/callup-api
- **Issues**: https://github.com/Romeobluesky/callup-api/issues

---

## ✅ 구현 완료 항목

- [x] JWT 기반 인증 시스템
- [x] 대시보드 API
- [x] DB 리스트 관리
- [x] CSV 파일 업로드 (EUC-KR 지원)
- [x] 자동 통화 API
- [x] 고객 검색 및 상세 조회
- [x] 통계 API (기간별)
- [x] CORS 미들웨어
- [x] 에러 핸들링
- [x] 트랜잭션 처리
- [x] Connection Pool 관리
