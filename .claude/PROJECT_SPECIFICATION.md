# CallUp API - 프로젝트 정의서

## 문서 정보
- **작성일**: 2025-10-29
- **버전**: 1.0.0
- **프로젝트명**: CallUp API (자동 발신 시스템 백엔드)
- **기술 스택**: Next.js 15, TypeScript, MySQL
- **마지막 업데이트**: 2025-10-29

---

## 프로젝트 개요

### 목적
업체별 자동 발신 시스템을 위한 REST API 서버. Flutter 앱과 연동하여 상담원 인증, 대시보드, 통화 관리, 통계 등의 기능을 제공합니다.

### 주요 기능
1. **인증 시스템**: 업체 계정 기반 상담원 로그인
2. **대시보드**: 상담원별 통화 통계 및 DB 목록
3. **자동 발신**: DB 기반 자동 통화 시작 및 로그 관리
4. **통계**: 업체/상담원별 통화 통계 조회
5. **고객 관리**: 고객 정보 검색 및 관리
6. **업체 관리자**: 상담원 등록/삭제, DB 할당

---

## 아키텍처

### 기술 스택
```yaml
Framework: Next.js 15 (App Router)
Language: TypeScript
Database: MySQL 8.0
Authentication: JWT (JSON Web Token)
Process Manager: PM2
Environment: Node.js 18+
```

### 디렉토리 구조
```
callup-api/
├── app/
│   └── api/
│       ├── auth/              # 인증 관련 API
│       │   ├── login/
│       │   ├── logout/
│       │   └── refresh/
│       ├── dashboard/         # 대시보드 API
│       │   └── status/
│       ├── auto-call/         # 자동 발신 API
│       │   ├── start/
│       │   ├── log/
│       │   └── next-customer/
│       ├── statistics/        # 통계 API
│       ├── customers/         # 고객 관리 API
│       ├── db-lists/          # DB 목록 관리 API
│       ├── call-logs/         # 통화 로그 API
│       ├── company-admin/     # 업체 관리자 API
│       └── admin/             # 슈퍼 관리자 API
├── lib/
│   ├── db.ts                 # 데이터베이스 연결
│   ├── jwt.ts                # JWT 토큰 처리
│   ├── auth.ts               # 인증 미들웨어
│   └── response.ts           # 응답 헬퍼 함수
├── .env                      # 환경 변수
└── package.json
```

---

## 데이터베이스 스키마

### 핵심 변경 사항 (2025-10-29)
**users 테이블에서 `company_id` → `company_login_id`로 변경**
- 외래 키 의존성 제거
- 로그인 성능 향상 (JOIN 불필요)

### 테이블 구조

#### 1. companies (업체)
```sql
CREATE TABLE companies (
  company_id INT PRIMARY KEY AUTO_INCREMENT,
  company_login_id VARCHAR(50) UNIQUE NOT NULL,  -- 업체 로그인 ID
  company_password VARCHAR(255) NOT NULL,        -- SHA2(256) 해시
  company_name VARCHAR(100) NOT NULL,
  max_agents INT DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. users (상담원) ⚠️ 변경됨
```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  company_login_id VARCHAR(50) NOT NULL,        -- ✅ company_id → company_login_id로 변경
  user_name VARCHAR(50) NOT NULL,
  user_phone VARCHAR(20),
  user_status_message VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company_login_id (company_login_id),
  INDEX idx_user_name (user_name)
);
```

#### 3. statistics (통계) ⚠️ 현재 사용 안 함
```sql
-- TODO: 테이블 구조 확인 필요
-- company_id 또는 company_login_id 중 어느 것을 사용하는지 확인 필요
```

#### 4. db_lists (DB 목록) ⚠️ 변경됨
```sql
CREATE TABLE db_lists (
  db_id INT PRIMARY KEY AUTO_INCREMENT,
  company_login_id VARCHAR(50) NOT NULL,        -- ✅ company_id → company_login_id로 변경
  db_title VARCHAR(100) NOT NULL,
  db_date DATE NOT NULL,
  total_count INT DEFAULT 0,
  unused_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_company_login_id (company_login_id)
);
```

#### 5. customers (고객)
```sql
CREATE TABLE customers (
  customer_id INT PRIMARY KEY AUTO_INCREMENT,
  db_id INT NOT NULL,
  customer_name VARCHAR(50),
  customer_phone VARCHAR(20) NOT NULL,
  customer_info1 VARCHAR(100),
  customer_info2 VARCHAR(100),
  customer_info3 VARCHAR(100),
  event_name VARCHAR(50),
  data_status ENUM('미사용', '사용완료') DEFAULT '미사용',
  assigned_user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (db_id) REFERENCES db_lists(db_id)
);
```

#### 6. call_logs (통화 로그)
```sql
CREATE TABLE call_logs (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  user_id INT NOT NULL,
  customer_id INT NOT NULL,
  call_result ENUM('연결', '실패', '콜백') NOT NULL,
  call_duration INT,                            -- 초 단위
  call_memo TEXT,
  call_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(company_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
```

---

## API 엔드포인트

### 인증 (Authentication)

#### POST /api/auth/login
로그인 API

**Request:**
```json
{
  "companyLoginId": "company_a",
  "companyPassword": "password123",
  "userName": "홍길동"
}
```

**Response (200 OK):**
```json
{
  "code": "SUCCESS",
  "message": "로그인 성공",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "userName": "홍길동",
      "userPhone": "010-1234-5678",
      "userStatusMessage": "상담 가능",
      "isActive": true,
      "lastLoginAt": "2025-10-29T09:00:00.000Z"
    },
    "company": {
      "companyId": 1,
      "companyLoginId": "company_a",
      "companyName": "테스트 업체",
      "maxAgents": 10,
      "isActive": true
    }
  }
}
```

**로직:**
1. `company_login_id` + `company_password`로 업체 인증
2. `company_login_id` + `user_name`으로 상담원 조회
3. JWT 토큰 생성 (payload에 `companyLoginId` 포함)
4. 최종 로그인 시간 업데이트

#### POST /api/auth/refresh
토큰 갱신

#### POST /api/auth/logout
로그아웃

---

### 대시보드 (Dashboard)

#### GET /api/dashboard
대시보드 데이터 조회

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "code": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": {
    "user": {
      "userId": 1,
      "userName": "홍길동",
      "userPhone": "010-1234-5678",
      "userStatusMessage": "상담 가능",
      "isActive": true,
      "lastActiveTime": "2025-10-29T09:00:00.000Z"
    },
    "todayStats": {
      "callCount": 0,
      "callDuration": "00:00:00"
    },
    "callResults": {
      "connected": 0,
      "failed": 0,
      "callback": 0
    },
    "dbLists": [
      {
        "dbId": 1,
        "date": "2025-10-29",
        "title": "고객 DB 1",
        "totalCount": 1000,
        "unusedCount": 850
      }
    ]
  }
}
```

**로직:**
1. JWT에서 사용자 정보 추출
2. users 테이블에서 사용자 정보 조회 (`company_login_id` 사용)
3. ~~statistics 테이블에서 오늘 통계 조회~~ (임시 스킵)
4. db_lists 테이블에서 활성 DB 목록 조회 (`company_login_id` 사용)

**⚠️ 현재 상태:**
- statistics 관련 쿼리는 임시로 제거됨 (테이블 구조 확인 필요)
- todayStats와 callResults는 기본값 0 반환

#### PUT /api/dashboard/status
상담원 상태 메시지 업데이트

---

### 자동 발신 (Auto Call)

#### POST /api/auto-call/start
자동 발신 시작

#### POST /api/auto-call/log
통화 로그 저장

#### GET /api/auto-call/next-customer
다음 고객 정보 조회

---

### 통계 (Statistics)

#### GET /api/statistics
통계 조회 (기간별, 상담원별)

---

### 고객 관리 (Customers)

#### GET /api/customers/search
고객 검색

#### GET /api/customers/[customerId]
고객 상세 정보

---

### DB 목록 관리 (DB Lists)

#### GET /api/db-lists
DB 목록 조회

#### POST /api/db-lists/upload
DB 업로드

#### PUT /api/db-lists/[dbId]/toggle
DB 활성화/비활성화

#### GET /api/db-lists/[dbId]/customers
특정 DB의 고객 목록

---

### 업체 관리자 (Company Admin)

#### GET /api/company-admin/agents
상담원 목록 조회

#### POST /api/company-admin/agents
상담원 등록

#### DELETE /api/company-admin/agents/[userId]
상담원 삭제

#### GET /api/company-admin/statistics
업체 전체 통계

#### POST /api/company-admin/db-assign
DB 할당

---

### 슈퍼 관리자 (Admin)

#### GET /api/admin/companies
전체 업체 목록

#### GET /api/admin/companies/[companyId]
업체 상세 정보

#### PUT /api/admin/companies/[companyId]/toggle
업체 활성화/비활성화

---

## JWT 토큰 구조

### Payload
```typescript
interface JwtPayload {
  userId: number           // 상담원 ID
  companyId: number        // 업체 ID (companies.company_id PK)
  companyLoginId: string   // 업체 로그인 ID (users 테이블 조회용)
  userName: string         // 상담원 이름
  role: 'super_admin' | 'company_admin' | 'agent'
  iat?: number            // 발급 시간
  exp?: number            // 만료 시간
}
```

### 사용 전략
- **users 테이블 조회**: `companyLoginId` 사용
- **다른 테이블 조회** (statistics, call_logs 등): `companyId` 사용
- **장점**: 서브쿼리/JOIN 불필요, 성능 최적화

---

## 응답 포맷

### 성공 응답
```typescript
{
  code: "SUCCESS" | string,
  message: string,
  data: any
}
```

### 에러 응답
```typescript
{
  code: "ERROR_CODE",
  message: string,
  data: null
}
```

### 주요 에러 코드
- `MISSING_FIELDS`: 필수 필드 누락
- `AUTH_INVALID_CREDENTIALS`: 인증 실패
- `AUTH_COMPANY_INACTIVE`: 비활성화된 업체
- `AUTH_USER_NOT_FOUND`: 상담원 없음
- `AUTH_USER_INACTIVE`: 비활성화된 상담원
- `UNAUTHORIZED`: 인증 필요
- `INTERNAL_SERVER_ERROR`: 서버 에러

---

## 환경 변수 (.env)

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=callup_db
DB_PORT=3306

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=production
```

---

## 배포 정보

### PM2 설정
```bash
# 앱 시작
pm2 start npm --name "callup-api" -- start

# 재시작
pm2 restart callup-api

# 로그 확인
pm2 logs callup-api

# 상태 확인
pm2 status
```

### 배포 프로세스
```bash
# 1. 최신 코드 가져오기
git pull origin main

# 2. 의존성 설치
npm install

# 3. 프로덕션 빌드
npm run build

# 4. PM2 재시작
pm2 restart callup-api

# 5. 로그 확인
pm2 logs callup-api --lines 50
```

---

## 최근 변경 사항 (2025-10-29)

### 데이터베이스 마이그레이션
**변경 내용:**
- `users` 테이블: `company_id` → `company_login_id`
- `db_lists` 테이블: `company_id` → `company_login_id`
- `statistics` 테이블: 구조 확인 필요 (현재 쿼리 비활성화)

**영향받은 API:**
- ✅ `/api/auth/login` - 수정 완료
- ✅ `/api/auth/refresh` - 수정 완료
- ✅ `/api/dashboard` - 수정 완료 (statistics 제외)
- ✅ `/api/dashboard/status` - 수정 완료
- ✅ `/api/users/status` - 수정 완료
- ✅ `/api/company-admin/agents` - 수정 완료
- ✅ `/api/company-admin/agents/[userId]` - 수정 완료
- ✅ `/api/db-lists` - 수정 완료
- ✅ `/api/db-lists/[dbId]/toggle` - 수정 완료
- ✅ `/api/customers/search` - 수정 완료
- ✅ `/api/customers/[customerId]` - 수정 완료
- ✅ `/api/statistics` - 수정 완료
- ✅ `/api/company-admin/statistics` - 수정 완료

### JWT Payload 확장
**추가된 필드:**
```typescript
companyLoginId: string  // users 테이블 조회용
```

**사용 목적:**
- users 테이블 조회 시 서브쿼리/JOIN 불필요
- 성능 최적화

---

## 테스트 가이드

### Postman 테스트 순서

#### 1. 로그인
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "companyLoginId": "실제_업체_로그인_아이디",
  "companyPassword": "업체_비밀번호",
  "userName": "실제_사용자_이름"
}
```

**성공 시:** 응답의 `data.token` 복사

#### 2. 대시보드 조회
```
GET http://localhost:3000/api/dashboard
Authorization: Bearer {복사한_토큰}
```

**성공 시:** 사용자 정보, DB 목록 확인 가능

#### 3. Postman Environment 설정
1. Environment 생성
2. Variables 추가:
   - `base_url`: `http://localhost:3000`
   - `token`: (로그인 후 자동 저장)

3. 로그인 API의 Tests 탭에 추가:
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("token", jsonData.data.token);
}
```

---

## TODO 및 알려진 이슈

### 긴급 (High Priority)
- [ ] **statistics 테이블 구조 확인**
  - `company_id` 또는 `company_login_id` 중 어느 것을 사용하는지 확인
  - 확인 후 `/api/dashboard`의 통계 쿼리 활성화
  - 영향받는 API: `/api/statistics`, `/api/company-admin/statistics`

### 일반 (Medium Priority)
- [ ] call_logs 테이블의 company_id 사용 확인
- [ ] 에러 로그 모니터링 및 분석
- [ ] API 응답 시간 최적화
- [ ] 통합 테스트 작성

### 향후 개선 (Low Priority)
- [ ] API 문서 자동화 (Swagger/OpenAPI)
- [ ] 로그 시스템 개선 (Winston 등)
- [ ] 캐싱 전략 구현 (Redis)
- [ ] Rate Limiting 구현

---

## 연락처 및 참고 자료

- **프로젝트 저장소**: (저장소 URL)
- **API 문서**: (문서 URL)
- **데이터베이스**: MySQL 8.0
- **서버 위치**: `/home/callup-api`

---

**문서 작성 완료일**: 2025-10-29
**다음 검토 예정일**: 2025-11-05
