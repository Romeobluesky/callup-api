# CallUp API 프로젝트 구조

## 디렉토리 구조

```
callup-api/
├── .claude/                      # Claude 설정 파일
│   ├── API_SERVER_SPEC.md       # API 서버 사양서
│   └── DATABASE_SCHEMA.md       # 데이터베이스 스키마
├── app/                         # Next.js App Router
│   ├── api/                     # API 라우트
│   │   ├── auth/               # 인증 관련 API
│   │   │   └── login/
│   │   │       └── route.ts    # POST /api/auth/login
│   │   ├── auto-call/          # 자동 통화 API
│   │   │   └── next-customer/
│   │   │       └── route.ts    # GET /api/auto-call/next-customer
│   │   ├── call-logs/          # 통화 기록 API
│   │   │   └── route.ts        # POST /api/call-logs
│   │   ├── customers/          # 고객 관리 API
│   │   │   ├── [customerId]/
│   │   │   │   └── route.ts    # GET /api/customers/:customerId
│   │   │   └── search/
│   │   │       └── route.ts    # GET /api/customers/search
│   │   ├── dashboard/          # 대시보드 API
│   │   │   └── route.ts        # GET /api/dashboard
│   │   ├── db/                 # 데이터베이스 테스트
│   │   │   └── test/
│   │   │       └── route.ts    # GET /api/db/test
│   │   ├── db-lists/           # DB 리스트 API
│   │   │   ├── [dbId]/
│   │   │   │   └── customers/
│   │   │   │       └── route.ts # GET /api/db-lists/:dbId/customers
│   │   │   ├── route.ts        # GET /api/db-lists
│   │   │   └── upload/
│   │   │       └── route.ts    # POST /api/db-lists/upload
│   │   ├── statistics/         # 통계 API
│   │   │   └── route.ts        # GET /api/statistics
│   │   └── users/              # 사용자 관리 API
│   │       └── status/
│   │           └── route.ts    # PATCH /api/users/status
│   ├── layout.tsx              # 루트 레이아웃
│   └── page.tsx                # 홈페이지
├── lib/                        # 유틸리티 라이브러리
│   ├── auth.ts                 # 인증 헬퍼
│   ├── db.ts                   # 데이터베이스 연결
│   ├── jwt.ts                  # JWT 토큰 유틸리티
│   └── response.ts             # API 응답 헬퍼
├── middleware.ts               # Next.js 미들웨어 (CORS)
├── ecosystem.config.js         # PM2 설정
├── next.config.ts              # Next.js 설정
├── tsconfig.json               # TypeScript 설정
├── package.json                # 프로젝트 의존성
├── .env                        # 환경 변수 (실제 값)
├── .env.example                # 환경 변수 예제
├── .gitignore                  # Git 제외 파일
├── API_ENDPOINTS.md            # API 엔드포인트 문서
├── DEPLOYMENT.md               # 배포 가이드
├── PROJECT_STRUCTURE.md        # 이 파일
└── README.md                   # 프로젝트 설명
```

---

## 주요 파일 설명

### 라이브러리 파일 (`lib/`)

#### `lib/db.ts`
- MySQL 데이터베이스 연결 풀 관리
- 쿼리 실행 헬퍼 함수
- 트랜잭션 처리
- 연결 테스트

**주요 함수:**
- `getPool()`: 연결 풀 반환
- `getConnection()`: 단일 연결 반환
- `query()`: SQL 쿼리 실행
- `transaction()`: 트랜잭션 실행
- `testConnection()`: 연결 테스트

#### `lib/jwt.ts`
- JWT 토큰 생성 및 검증
- 토큰 디코딩

**주요 함수:**
- `generateToken()`: JWT 토큰 생성
- `verifyToken()`: JWT 토큰 검증
- `decodeToken()`: JWT 토큰 디코딩

#### `lib/auth.ts`
- 요청 인증 처리
- Authorization 헤더에서 토큰 추출
- 사용자 인증 확인

**주요 함수:**
- `extractToken()`: 헤더에서 토큰 추출
- `authenticate()`: 사용자 인증 및 페이로드 반환
- `isAuthenticated()`: 인증 여부 확인

#### `lib/response.ts`
- API 응답 포맷 표준화
- 성공/에러 응답 헬퍼

**주요 함수:**
- `successResponse()`: 성공 응답 생성
- `errorResponse()`: 에러 응답 생성
- `unauthorizedResponse()`: 401 응답 생성
- `forbiddenResponse()`: 403 응답 생성
- `notFoundResponse()`: 404 응답 생성
- `serverErrorResponse()`: 500 응답 생성

---

## API 라우트 (`app/api/`)

### 인증 API
- **POST /api/auth/login**: 사용자 로그인 및 JWT 토큰 발급

### 대시보드 API
- **GET /api/dashboard**: 대시보드 데이터 조회 (사용자, 통계, DB 리스트)

### 사용자 API
- **PATCH /api/users/status**: 사용자 상태 및 메시지 업데이트

### DB 리스트 API
- **GET /api/db-lists**: DB 리스트 전체 조회
- **GET /api/db-lists/:dbId/customers**: 특정 DB의 고객 목록 조회
- **POST /api/db-lists/upload**: CSV 파일 업로드 및 DB 생성

### 자동 통화 API
- **GET /api/auto-call/next-customer**: 다음 미사용 고객 조회
- **POST /api/call-logs**: 통화 결과 저장 및 통계 업데이트

### 고객 API
- **GET /api/customers/search**: 고객 검색 (이름, 전화번호, 이벤트명, 통화결과)
- **GET /api/customers/:customerId**: 고객 상세 정보 조회

### 통계 API
- **GET /api/statistics**: 기간별 통화 통계 조회 (today/week/month/all)

### 테스트 API
- **GET /api/db/test**: 데이터베이스 연결 테스트

---

## 환경 변수 (`.env`)

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

---

## 데이터베이스 구조

### 주요 테이블

1. **users**: 상담원 정보
   - user_id, user_login_id, user_name, user_password
   - user_phone, user_status_message, is_active

2. **db_lists**: DB 리스트 (CSV 파일 메타데이터)
   - db_id, db_title, db_date, file_name
   - total_count, unused_count, is_active

3. **customers**: 고객 정보 (CSV 데이터)
   - customer_id, db_id, event_name
   - customer_phone, customer_name
   - customer_info1, customer_info2, customer_info3
   - data_status, call_result, consultation_result
   - call_datetime, call_duration, memo

4. **call_logs**: 통화 기록
   - log_id, user_id, customer_id, db_id
   - call_datetime, call_result, consultation_result
   - call_duration, memo

5. **statistics**: 일별 통계
   - stat_id, user_id, stat_date
   - total_call_count, total_call_time
   - success_count, failed_count, callback_count

---

## 미들웨어 (`middleware.ts`)

- **CORS 처리**: 모든 API 요청에 CORS 헤더 추가
- **Preflight 요청 처리**: OPTIONS 메서드 처리
- **Origin 검증**: 허용된 도메인만 접근 가능

---

## 의존성 패키지

### Production Dependencies
- `next`: Next.js 프레임워크
- `react`, `react-dom`: React 라이브러리
- `mysql2`: MySQL 클라이언트
- `bcryptjs`: 비밀번호 해싱
- `jsonwebtoken`: JWT 토큰 관리
- `iconv-lite`: 문자 인코딩 변환 (CSV)

### Development Dependencies
- `typescript`: TypeScript 컴파일러
- `@types/node`: Node.js 타입 정의
- `@types/react`: React 타입 정의
- `@types/bcryptjs`: bcryptjs 타입 정의
- `@types/jsonwebtoken`: JWT 타입 정의

---

## 개발 및 배포

### 개발 환경
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# http://localhost:3000 에서 접속
```

### 프로덕션 빌드
```bash
# 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

### PM2 배포
```bash
# PM2로 실행
pm2 start ecosystem.config.js

# PM2 상태 확인
pm2 status

# PM2 로그 확인
pm2 logs callup-api
```

---

## 보안 고려사항

1. **JWT Secret**: 32자 이상의 강력한 시크릿 키 사용
2. **비밀번호**: bcrypt로 해싱 (cost factor: 10)
3. **SQL Injection**: Prepared Statements 사용
4. **CORS**: 프로덕션에서 특정 도메인만 허용
5. **HTTPS**: SSL 인증서 필수 사용
6. **환경 변수**: .env 파일을 Git에 커밋하지 않음

---

## 성능 최적화

1. **Connection Pool**: MySQL 연결 풀 사용 (기본 10개)
2. **트랜잭션**: 여러 쿼리를 하나의 트랜잭션으로 처리
3. **인덱스**: 주요 컬럼에 인덱스 설정
4. **페이지네이션**: 대용량 데이터 조회 시 페이지네이션 적용
5. **CSV 업로드**: 벌크 인서트로 성능 향상

---

## 테스트

### 데이터베이스 연결 테스트
```bash
curl http://localhost:3000/api/db/test
```

### 로그인 테스트
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"admin01","userName":"김상담","password":"password123"}'
```

### 대시보드 테스트 (JWT 필요)
```bash
curl -X GET http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 참고 문서

- **API 엔드포인트**: `API_ENDPOINTS.md`
- **배포 가이드**: `DEPLOYMENT.md`
- **데이터베이스 스키마**: `.claude/DATABASE_SCHEMA.md`
- **API 사양서**: `.claude/API_SERVER_SPEC.md`
