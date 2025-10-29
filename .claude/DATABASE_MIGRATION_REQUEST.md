# 데이터베이스 스키마 변경에 따른 API 수정 요청

## 문서 정보
- **작성일**: 2025-10-29
- **요청자**: Flutter 앱 개발팀
- **우선순위**: 🔴 긴급 (로그인 불가)
- **영향 범위**: 인증 시스템 전체

---

## 문제 상황

### 현재 증상
- ❌ Flutter 앱 로그인 불가
- ❌ API 응답: "업체 ID, 비밀번호, 상담원 이름을 모두 입력해주세요" (MISSING_FIELDS)
- ❌ 서버 로그 에러: `Unknown column 'company_id' in 'where clause'`

### 원인
데이터베이스 `users` 테이블에서 `company_id` 컬럼이 삭제되고 `company_login_id`로 변경되었으나, **백엔드 API 코드는 여전히 `company_id` 컬럼을 사용**하고 있음.

### 에러 로그
```
Server error: Error: Unknown column 'company_id' in 'where clause'
SQL: SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
     FROM users
     WHERE company_id = ? AND user_name = ?
```

---

## 데이터베이스 스키마 변경 내역

### users 테이블 변경사항

#### Before (기존)
```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,                    -- ❌ 삭제됨
  user_name VARCHAR(50) NOT NULL,
  user_phone VARCHAR(20),
  user_status_message VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(company_id)
);
```

#### After (변경됨)
```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  company_login_id VARCHAR(50) NOT NULL,      -- ✅ 새로 추가 (업체 구분자)
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

### 변경 이유
- 업체 ID를 외래 키(`company_id`) 대신 **로그인 ID(`company_login_id`)로 직접 저장**
- `companies` 테이블에 대한 외래 키 의존성 제거
- 로그인 성능 향상 (JOIN 불필요)

---

## API 수정 요청 사항

### 1. 로그인 API 수정 (/api/auth/login)

#### 파일 위치 (추정)
- `app/api/auth/login/route.js` 또는
- `src/app/api/auth/login/route.js` (Next.js 15)

#### 수정 내용

**Step 1: 업체 인증 쿼리 (변경 없음)**
```sql
-- 이 부분은 그대로 유지
SELECT company_id, company_name, company_login_id, max_agents, is_active
FROM companies
WHERE company_login_id = ? AND company_password = SHA2(?, 256);
```

**Step 2: 상담원 조회 쿼리 (수정 필요)**

**Before (기존 코드)**:
```sql
SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
FROM users
WHERE company_id = ? AND user_name = ?;
```

**After (수정 요청)**:
```sql
SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
FROM users
WHERE company_login_id = ? AND user_name = ?;
```

**변경 포인트**:
- `company_id` → `company_login_id`
- `?` 파라미터는 `companies` 쿼리 결과에서 가져온 `company_login_id` 값 사용

**Step 3: 최종 로그인 시간 업데이트 (변경 없음)**
```sql
UPDATE users SET last_login_at = NOW() WHERE user_id = ?;
```

**Step 4: JWT 토큰 생성 (Payload 수정 필요)**

**Before (기존)**:
```javascript
const token = jwt.sign({
  userId: user.user_id,
  companyId: company.company_id,        // ← 이 값은 유지 (companies 테이블 PK)
  userName: user.user_name,
  role: 'agent'
}, JWT_SECRET);
```

**After (수정 요청)**:
```javascript
const token = jwt.sign({
  userId: user.user_id,
  companyId: company.company_id,        // ← companies.company_id (PK, 유지)
  companyLoginId: company.company_login_id,  // ← 새로 추가 (로그인 ID)
  userName: user.user_name,
  role: 'agent'
}, JWT_SECRET);
```

**주의**: JWT에는 `companies.company_id` (PK)를 유지하되, `company_login_id`도 함께 포함

---

### 2. 대시보드 API 수정 (/api/dashboard)

#### 수정 내용

**사용자 정보 조회 쿼리 (수정 필요)**

**Before**:
```sql
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_id = ?;
```

**After**:
```sql
-- Option 1: JWT에서 companyId를 사용하는 경우 (권장)
-- JWT의 companyId로 company_login_id를 조회한 후 사용
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_login_id = (
  SELECT company_login_id FROM companies WHERE company_id = ?
);

-- Option 2: JWT에 companyLoginId를 추가한 경우 (더 간단)
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_login_id = ?;
```

**오늘 통계 조회 (변경 없음)**:
```sql
-- statistics 테이블은 company_id를 그대로 사용 (FK 유지)
SELECT total_call_count, total_call_time
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE();
```

**DB 리스트 조회 (변경 없음)**:
```sql
-- db_lists 테이블도 company_id를 그대로 사용 (FK 유지)
SELECT db_id, db_date, db_title, total_count, unused_count
FROM db_lists
WHERE company_id = ? AND is_active = TRUE
ORDER BY db_date DESC
LIMIT 3;
```

---

### 3. 상담원 상태 토글 API (/api/dashboard/status)

#### 수정 내용

**Before**:
```sql
UPDATE users
SET user_status_message = CASE WHEN ? = TRUE THEN '업무 중' ELSE '대기 중' END
WHERE user_id = ? AND company_id = ?;
```

**After (Option 1 - 권장)**:
```sql
UPDATE users u
JOIN companies c ON u.company_login_id = c.company_login_id
SET u.user_status_message = CASE WHEN ? = TRUE THEN '업무 중' ELSE '대기 중' END
WHERE u.user_id = ? AND c.company_id = ?;
```

**After (Option 2 - JWT에 companyLoginId 포함 시)**:
```sql
UPDATE users
SET user_status_message = CASE WHEN ? = TRUE THEN '업무 중' ELSE '대기 중' END
WHERE user_id = ? AND company_login_id = ?;
```

---

### 4. 자동 통화 시작 API (/api/auto-call/start)

#### 수정 내용

**미사용 고객 조회 쿼리 (변경 없음)**:
```sql
-- customers 테이블은 db_id를 사용하므로 변경 없음
SELECT customer_id, db_id, customer_name, customer_phone,
       customer_info1, customer_info2, customer_info3, event_name
FROM customers
WHERE db_id = ?
  AND data_status = '미사용'
  AND (assigned_user_id IS NULL OR assigned_user_id = ?)
ORDER BY customer_id
LIMIT ?;
```

**할당 정보 업데이트 (변경 없음)**:
```sql
UPDATE customers
SET assigned_user_id = ?
WHERE customer_id IN (?, ?, ...);
```

---

### 5. 업체 관리자 API 수정

#### 상담원 목록 조회 (/api/company-admin/agents)

**Before**:
```sql
SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
FROM users
WHERE company_id = ?
ORDER BY user_name;
```

**After (Option 1)**:
```sql
SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
FROM users
WHERE company_login_id = (
  SELECT company_login_id FROM companies WHERE company_id = ?
)
ORDER BY user_name;
```

**After (Option 2)**:
```sql
SELECT u.user_id, u.user_name, u.user_phone, u.user_status_message, u.is_active, u.last_login_at
FROM users u
JOIN companies c ON u.company_login_id = c.company_login_id
WHERE c.company_id = ?
ORDER BY u.user_name;
```

#### 상담원 등록 (/api/company-admin/agents)

**Before**:
```sql
INSERT INTO users (company_id, user_name, user_phone)
VALUES (?, ?, ?);
```

**After**:
```sql
INSERT INTO users (company_login_id, user_name, user_phone)
SELECT company_login_id, ?, ?
FROM companies
WHERE company_id = ?;
```

---

## 권장 해결 방안

### Option 1: JWT Payload 확장 (권장) ⭐

**장점**:
- 쿼리 성능 최적화 (서브쿼리/JOIN 불필요)
- 코드 간결성
- 확장성 우수

**JWT Payload**:
```javascript
{
  userId: 1,
  companyId: 2,              // companies.company_id (PK) - 다른 테이블 FK 참조용
  companyLoginId: "company_a", // 새로 추가 - users 테이블 조회용
  userName: "홍길동",
  role: "agent"
}
```

**사용 예시**:
```javascript
// users 테이블 조회 시
WHERE user_id = decoded.userId AND company_login_id = decoded.companyLoginId

// 다른 테이블 (statistics, db_lists 등) 조회 시
WHERE company_id = decoded.companyId
```

---

### Option 2: 서브쿼리 사용

**장점**:
- JWT 구조 변경 불필요

**단점**:
- 쿼리 성능 저하 (서브쿼리 실행)

**예시**:
```sql
SELECT * FROM users
WHERE user_id = ? AND company_login_id = (
  SELECT company_login_id FROM companies WHERE company_id = ?
);
```

---

## 테스트 방법

### 1. 로그인 테스트

**요청**:
```bash
curl -X POST https://api.autocallup.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "companyLoginId": "test",
    "companyPassword": "test123",
    "userName": "김상담"
  }'
```

**기대 응답**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "userName": "김상담",
      "userPhone": "010-2345-6789",
      "userStatusMessage": "업무 중",
      "isActive": true
    },
    "company": {
      "companyId": 2,
      "companyLoginId": "test",
      "companyName": "테스트 업체",
      "maxAgents": 5,
      "isActive": true
    }
  }
}
```

### 2. 대시보드 API 테스트

```bash
curl -X GET https://api.autocallup.com/api/dashboard \
  -H "Authorization: Bearer <token>"
```

### 3. 데이터베이스 확인

```sql
-- users 테이블 구조 확인
DESCRIBE users;

-- 테스트 데이터 확인
SELECT user_id, company_login_id, user_name, user_phone
FROM users
WHERE company_login_id = 'test';

-- companies 테이블 확인
SELECT company_id, company_login_id, company_name
FROM companies
WHERE company_login_id = 'test';
```

---

## 영향 받는 API 엔드포인트 목록

### 🔴 긴급 수정 필요 (로그인 불가)
- [x] `POST /api/auth/login` - 로그인
- [ ] `GET /api/dashboard` - 대시보드 조회
- [ ] `PUT /api/dashboard/status` - 상담원 상태 토글

### 🟡 중요 수정 필요 (기능 영향)
- [ ] `GET /api/company-admin/agents` - 상담원 목록
- [ ] `POST /api/company-admin/agents` - 상담원 등록
- [ ] `DELETE /api/company-admin/agents/:userId` - 상담원 삭제

### 🟢 확인 필요 (영향 여부 불확실)
- [ ] `POST /api/auto-call/start` - 자동 통화 시작
- [ ] `POST /api/auto-call/log` - 통화 로그 저장
- [ ] `POST /api/call-result` - 통화 결과 저장
- [ ] `GET /api/customers/search` - 고객 검색
- [ ] `GET /api/statistics` - 통계 조회

---

## 추가 확인 사항

1. **다른 테이블의 company_id 사용 여부**:
   - `statistics` 테이블: `company_id` FK 유지
   - `db_lists` 테이블: `company_id` FK 유지
   - `customers` 테이블: `db_id` 사용 (간접 참조)
   - `call_logs` 테이블: `company_id` FK 유지

2. **JWT 토큰 필드 추가 확인**:
   - 기존 토큰: `{ userId, companyId, userName, role }`
   - 권장 토큰: `{ userId, companyId, companyLoginId, userName, role }`

3. **에러 로그 모니터링**:
   - 수정 후 `/home/callup-api/logs/err-0.log` 확인
   - `Unknown column 'company_id'` 에러가 더 이상 발생하지 않아야 함

---

## 참고 문서

- `API_DESIGN_v3.0.0.md` - API 설계 문서 (23-28줄: 로그인 요청 구조)
- `DATABASE_SCHEMA.md` - 데이터베이스 스키마 (변경 전 v2.0.0)
- PM2 로그: `/home/callup-api/logs/err-0.log`

---

## 연락처

- **Flutter 앱 개발팀**: [연락처]
- **우선순위**: 🔴 긴급 (앱 로그인 불가 상태)
- **예상 작업 시간**: 1-2시간

---

**작성 완료일**: 2025-10-29
**마지막 업데이트**: 2025-10-29 13:42
