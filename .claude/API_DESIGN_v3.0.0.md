# CallUp API 설계 문서 v3.0.0

## 개요

업체 계정 기반 시스템으로 변경된 CallUp의 새로운 백엔드 API 설계 문서입니다.

**주요 변경사항**:
- 개인 로그인 → 업체 기반 로그인 (업체 ID + 비밀번호 + 상담원 이름)
- JWT 토큰에 company_id 포함
- 모든 API 요청에 업체 격리 (company_id 기반 필터링)
- 슈퍼 관리자 API 추가
- 업체 관리자 API 추가

---

## 인증 (Authentication)

### 1. 업체 기반 로그인

**Endpoint**: `POST /api/auth/login`

**요청**:
```json
{
  "companyLoginId": "company_a",
  "companyPassword": "test123",
  "userName": "홍길동"
}
```

**응답 (성공)**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 1,
      "userName": "홍길동",
      "userPhone": "010-1111-1111",
      "userStatusMessage": "업무 중",
      "isActive": true,
      "lastLoginAt": "2025-10-22T14:30:00Z"
    },
    "company": {
      "companyId": 2,
      "companyName": "A 업체",
      "maxAgents": 5,
      "isActive": true
    }
  }
}
```

**응답 (실패)**:
```json
{
  "success": false,
  "message": "업체 ID 또는 비밀번호가 잘못되었습니다.",
  "errorCode": "AUTH_INVALID_CREDENTIALS"
}
```

**백엔드 로직**:
```sql
-- Step 1: 업체 인증
SELECT company_id, company_name, max_agents, is_active
FROM companies
WHERE company_login_id = ? AND company_password = SHA2(?, 256);

-- Step 2: 상담원 조회
SELECT user_id, user_name, user_phone, user_status_message, is_active
FROM users
WHERE company_id = ? AND user_name = ?;

-- Step 3: 최종 로그인 시간 업데이트
UPDATE users SET last_login_at = NOW() WHERE user_id = ?;

-- Step 4: JWT 토큰 생성
-- Payload: { userId, companyId, userName, role: 'agent' }
```

**에러 코드**:
- `AUTH_INVALID_CREDENTIALS`: 업체 ID/비밀번호 불일치
- `AUTH_USER_NOT_FOUND`: 상담원 이름 없음
- `AUTH_COMPANY_INACTIVE`: 업체 비활성화 (구독 만료)
- `AUTH_USER_INACTIVE`: 상담원 비활성화

---

### 2. 토큰 갱신

**Endpoint**: `POST /api/auth/refresh`

**요청 헤더**:
```
Authorization: Bearer <old_token>
```

**응답**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. 로그아웃

**Endpoint**: `POST /api/auth/logout`

**요청 헤더**:
```
Authorization: Bearer <token>
```

**응답**:
```json
{
  "success": true,
  "message": "로그아웃 완료"
}
```

---

## 대시보드 (Dashboard)

### 1. 대시보드 데이터 조회

**Endpoint**: `GET /api/dashboard`

**요청 헤더**:
```
Authorization: Bearer <token>
```

**응답**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userName": "홍길동",
      "userPhone": "010-1111-1111",
      "statusMessage": "업무 중",
      "lastActiveTime": "2025-10-22T14:30:00Z",
      "isOn": true
    },
    "todayStats": {
      "callCount": 150,
      "callDuration": "02:30:45"
    },
    "callStats": {
      "connectedCount": 120,
      "failedCount": 25,
      "callbackCount": 5
    },
    "dbLists": [
      {
        "dbId": 1,
        "date": "2025-10-14",
        "title": "이벤트01_251014",
        "total": 500,
        "unused": 250
      }
    ]
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 userId, companyId 추출

-- 1. 사용자 정보
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_id = ?;

-- 2. 오늘 통계
SELECT total_call_count, total_call_time
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE();

-- 3. 통화 상태별 통계
SELECT success_count, failed_count, callback_count
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE();

-- 4. DB 리스트 (최근 3개)
SELECT db_id, db_date, db_title, total_count, unused_count
FROM db_lists
WHERE company_id = ? AND is_active = TRUE
ORDER BY db_date DESC
LIMIT 3;
```

---

### 2. 상담원 상태 토글

**Endpoint**: `PUT /api/dashboard/status`

**요청**:
```json
{
  "isOn": true
}
```

**응답**:
```json
{
  "success": true,
  "message": "상태가 업데이트되었습니다.",
  "data": {
    "isOn": true
  }
}
```

**백엔드 로직**:
```sql
UPDATE users
SET user_status_message = CASE WHEN ? = TRUE THEN '업무 중' ELSE '대기 중' END
WHERE user_id = ? AND company_id = ?;
```

---

## DB 리스트 (DB Lists)

### 1. DB 리스트 전체 조회

**Endpoint**: `GET /api/db-lists`

**쿼리 파라미터**:
- `search` (옵션): 제목 검색 키워드

**요청 헤더**:
```
Authorization: Bearer <token>
```

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "dbId": 1,
      "companyId": 2,
      "date": "2025-10-14",
      "title": "이벤트01_251014",
      "total": 500,
      "unused": 250,
      "isActive": true
    },
    {
      "dbId": 2,
      "companyId": 2,
      "date": "2025-10-15",
      "title": "이벤트02_251015",
      "total": 300,
      "unused": 180,
      "isActive": true
    }
  ]
}
```

**백엔드 로직**:
```sql
SELECT db_id, company_id, db_date, db_title, total_count, unused_count, is_active
FROM db_lists
WHERE company_id = ?
  AND (? IS NULL OR db_title LIKE CONCAT('%', ?, '%'))
ORDER BY db_date DESC;
```

---

### 2. DB 활성화/비활성화 토글

**Endpoint**: `PUT /api/db-lists/:dbId/toggle`

**요청**:
```json
{
  "isActive": false
}
```

**응답**:
```json
{
  "success": true,
  "message": "DB 상태가 업데이트되었습니다.",
  "data": {
    "dbId": 1,
    "isActive": false
  }
}
```

**백엔드 로직**:
```sql
UPDATE db_lists
SET is_active = ?
WHERE db_id = ? AND company_id = ?;
```

---

## 자동 통화 (Auto Call)

### 1. 자동 통화 시작 (고객 큐 가져오기)

**Endpoint**: `POST /api/auto-call/start`

**요청**:
```json
{
  "dbId": 1,
  "count": 100
}
```

**응답**:
```json
{
  "success": true,
  "message": "자동 통화 준비 완료",
  "data": {
    "customers": [
      {
        "customerId": 1,
        "dbId": 1,
        "name": "김철수",
        "phone": "010-1234-5678",
        "info1": "인천 부평구",
        "info2": "30대 남성",
        "info3": "쿠팡 이벤트",
        "eventName": "이벤트01_경기인천"
      },
      // ... 99개 더
    ],
    "totalCount": 100
  }
}
```

**백엔드 로직**:
```sql
-- 1. 미사용 고객 조회
SELECT customer_id, db_id, customer_name, customer_phone,
       customer_info1, customer_info2, customer_info3, event_name
FROM customers
WHERE db_id = ?
  AND data_status = '미사용'
  AND (assigned_user_id IS NULL OR assigned_user_id = ?)
ORDER BY customer_id
LIMIT ?;

-- 2. 할당 정보 업데이트
UPDATE customers
SET assigned_user_id = ?
WHERE customer_id IN (?, ?, ...);

-- 3. DB 할당 추적 (db_assignments)
INSERT INTO db_assignments (db_id, user_id, company_id, assigned_count)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  assigned_count = assigned_count + ?,
  updated_at = NOW();
```

---

### 2. 통화 로그 저장 (자동)

**Endpoint**: `POST /api/auto-call/log`

**요청**:
```json
{
  "customerId": 1,
  "dbId": 1,
  "callResult": "부재중",
  "consultationResult": "자동 부재중 처리",
  "callDuration": "00:00:00"
}
```

**응답**:
```json
{
  "success": true,
  "message": "통화 로그 저장 완료",
  "data": {
    "logId": 123
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 userId, companyId 추출

-- 1. 통화 로그 삽입
INSERT INTO call_logs (
  company_id, user_id, customer_id, db_id,
  call_datetime, call_duration, call_result, consultation_result
) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?);

-- 2. 고객 정보 업데이트
UPDATE customers
SET
  data_status = '사용완료',
  call_result = ?,
  consultation_result = ?,
  call_datetime = NOW(),
  call_duration = ?,
  last_modified_date = NOW()
WHERE customer_id = ?;

-- 3. statistics 자동 갱신 (트리거)
```

---

## 통화 결과 (Call Result)

### 1. 통화 결과 저장

**Endpoint**: `POST /api/call-result`

**요청**:
```json
{
  "customerId": 1,
  "dbId": 1,
  "callResult": "통화성공",
  "consultationResult": "상품 구매 희망. 다음 주 월요일에 재통화 예정.",
  "memo": "오전 10시 이후 연락 가능",
  "callStartTime": "14:25:00",
  "callEndTime": "14:36:24",
  "callDuration": "00:11:24",
  "reservationDate": "2025-10-28",
  "reservationTime": "10:00:00"
}
```

**응답**:
```json
{
  "success": true,
  "message": "통화 결과 저장 완료",
  "data": {
    "logId": 124,
    "customerId": 1
  }
}
```

**백엔드 로직**:
```sql
-- 1. 통화 로그 삽입
INSERT INTO call_logs (
  company_id, user_id, customer_id, db_id,
  call_datetime, call_start_time, call_end_time, call_duration,
  call_result, consultation_result, memo
) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?);

-- 2. 고객 정보 업데이트
UPDATE customers
SET
  data_status = '사용완료',
  call_result = ?,
  consultation_result = ?,
  memo = ?,
  call_datetime = NOW(),
  call_start_time = ?,
  call_end_time = ?,
  call_duration = ?,
  reservation_date = ?,
  reservation_time = ?,
  last_modified_date = NOW()
WHERE customer_id = ?;
```

---

## 고객 관리 (Customer Management)

### 1. 고객 검색

**Endpoint**: `GET /api/customers/search`

**쿼리 파라미터**:
- `name` (옵션): 고객명
- `phone` (옵션): 전화번호
- `eventName` (옵션): 이벤트명
- `callResult` (옵션): 통화 결과
- `page` (옵션): 페이지 번호 (기본값: 1)
- `limit` (옵션): 페이지당 개수 (기본값: 20)

**응답**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customerId": 1,
        "dbId": 1,
        "date": "2025-10-01",
        "eventName": "이벤트01_경기인천",
        "name": "김숙자",
        "phone": "010-1234-5687",
        "callStatus": "통화성공",
        "callDateTime": "2025-10-15T15:25:00Z",
        "callDuration": "00:11:24",
        "memo": "다음주에 다시 통화하기로함",
        "hasAudio": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalCount": 200,
      "limit": 20
    }
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 companyId 추출

SELECT
  c.customer_id, c.db_id, d.db_date, c.event_name,
  c.customer_name, c.customer_phone,
  c.call_result, c.call_datetime, c.call_duration, c.memo,
  cl.has_audio
FROM customers c
JOIN db_lists d ON c.db_id = d.db_id
LEFT JOIN call_logs cl ON c.customer_id = cl.customer_id
WHERE d.company_id = ?
  AND (? IS NULL OR c.customer_name LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR c.customer_phone LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR c.event_name LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR c.call_result = ?)
ORDER BY c.call_datetime DESC
LIMIT ? OFFSET ?;
```

---

### 2. 고객 상세 조회

**Endpoint**: `GET /api/customers/:customerId`

**응답**:
```json
{
  "success": true,
  "data": {
    "customerId": 1,
    "dbId": 1,
    "assignedUserId": 1,
    "eventName": "이벤트01_경기인천",
    "name": "김철수",
    "phone": "010-1234-5678",
    "info1": "인천 부평구",
    "info2": "30대 남성",
    "info3": "쿠팡 이벤트",
    "dataStatus": "사용완료",
    "callResult": "통화성공",
    "consultationResult": "상품 구매 희망",
    "memo": "오전 10시 이후 연락 가능",
    "callDateTime": "2025-10-15T14:25:00Z",
    "callStartTime": "14:25:00",
    "callEndTime": "14:36:24",
    "callDuration": "00:11:24",
    "reservationDate": "2025-10-28",
    "reservationTime": "10:00:00",
    "uploadDate": "2025-10-14",
    "lastModifiedDate": "2025-10-15T14:36:24Z"
  }
}
```

---

## 통계 현황 (Statistics)

### 1. 상담원 통계 조회

**Endpoint**: `GET /api/statistics`

**쿼리 파라미터**:
- `period`: `today` | `week` | `month` | `all`

**응답**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userName": "홍길동",
      "userId": 1
    },
    "period": "today",
    "stats": {
      "totalCallTime": "15:02:45",
      "totalCallCount": 250,
      "successCount": 120,
      "failedCount": 80,
      "callbackCount": 30,
      "noAnswerCount": 20,
      "assignedDbCount": 3,
      "unusedDbCount": 150
    }
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 userId, companyId 추출

-- period = 'today'
SELECT
  SUM(TIME_TO_SEC(total_call_time)) AS total_seconds,
  SUM(total_call_count) AS total_call_count,
  SUM(success_count) AS success_count,
  SUM(failed_count) AS failed_count,
  SUM(callback_count) AS callback_count,
  SUM(no_answer_count) AS no_answer_count
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE();

-- period = 'week'
... AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

-- period = 'month'
... AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH);

-- period = 'all'
... (날짜 필터 없음)
```

---

## 슈퍼 관리자 API (Super Admin)

### 1. 전체 업체 목록 조회

**Endpoint**: `GET /api/admin/companies`

**요청 헤더**:
```
Authorization: Bearer <super_admin_token>
```

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "companyId": 2,
      "companyLoginId": "company_a",
      "companyName": "A 업체",
      "maxAgents": 5,
      "currentAgents": 3,
      "isActive": true,
      "subscriptionStartDate": "2025-01-01",
      "subscriptionEndDate": "2026-01-01",
      "adminName": "김관리자",
      "adminPhone": "010-1111-1111",
      "adminEmail": "admin@company-a.com",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**백엔드 로직**:
```sql
SELECT
  c.company_id, c.company_login_id, c.company_name,
  c.max_agents, COUNT(u.user_id) AS current_agents,
  c.is_active, c.subscription_start_date, c.subscription_end_date,
  c.admin_name, c.admin_phone, c.admin_email, c.created_at
FROM companies c
LEFT JOIN users u ON c.company_id = u.company_id AND u.is_active = TRUE
GROUP BY c.company_id
ORDER BY c.created_at DESC;
```

---

### 2. 업체 등록

**Endpoint**: `POST /api/admin/companies`

**요청**:
```json
{
  "companyLoginId": "new_company",
  "companyPassword": "secure_password",
  "companyName": "신규 업체",
  "maxAgents": 10,
  "subscriptionStartDate": "2025-10-22",
  "subscriptionEndDate": "2026-10-22",
  "adminName": "박관리자",
  "adminPhone": "010-9999-9999",
  "adminEmail": "admin@new-company.com"
}
```

**응답**:
```json
{
  "success": true,
  "message": "업체 등록 완료",
  "data": {
    "companyId": 4,
    "companyLoginId": "new_company"
  }
}
```

**백엔드 로직**:
```sql
INSERT INTO companies (
  company_login_id, company_password, company_name, max_agents,
  subscription_start_date, subscription_end_date,
  admin_name, admin_phone, admin_email
) VALUES (?, SHA2(?, 256), ?, ?, ?, ?, ?, ?, ?);
```

---

### 3. 업체 활성화/비활성화

**Endpoint**: `PUT /api/admin/companies/:companyId/toggle`

**요청**:
```json
{
  "isActive": false
}
```

**응답**:
```json
{
  "success": true,
  "message": "업체 상태가 업데이트되었습니다.",
  "data": {
    "companyId": 2,
    "isActive": false
  }
}
```

**백엔드 로직**:
```sql
UPDATE companies
SET is_active = ?
WHERE company_id = ?;
```

---

### 4. 업체 삭제

**Endpoint**: `DELETE /api/admin/companies/:companyId`

**응답**:
```json
{
  "success": true,
  "message": "업체가 삭제되었습니다."
}
```

**주의**: 외래 키 제약 조건으로 인해 관련 데이터(users, db_lists 등)가 있으면 삭제 불가. 대신 `isActive = false`로 비활성화 권장.

---

## 업체 관리자 API (Company Admin)

### 1. 소속 상담원 목록 조회

**Endpoint**: `GET /api/company-admin/agents`

**요청 헤더**:
```
Authorization: Bearer <company_admin_token>
```

**응답**:
```json
{
  "success": true,
  "data": {
    "maxAgents": 5,
    "currentAgents": 3,
    "agents": [
      {
        "userId": 1,
        "userName": "홍길동",
        "userPhone": "010-1111-1111",
        "statusMessage": "업무 중",
        "isActive": true,
        "lastLoginAt": "2025-10-22T14:30:00Z"
      },
      {
        "userId": 2,
        "userName": "김영희",
        "userPhone": "010-1111-2222",
        "statusMessage": "대기 중",
        "isActive": true,
        "lastLoginAt": "2025-10-22T10:15:00Z"
      }
    ]
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 companyId 추출

-- 업체 정보
SELECT max_agents FROM companies WHERE company_id = ?;

-- 상담원 목록
SELECT user_id, user_name, user_phone, user_status_message, is_active, last_login_at
FROM users
WHERE company_id = ?
ORDER BY user_name;
```

---

### 2. 상담원 등록

**Endpoint**: `POST /api/company-admin/agents`

**요청**:
```json
{
  "userName": "강감찬",
  "userPhone": "010-3333-1111"
}
```

**응답**:
```json
{
  "success": true,
  "message": "상담원 등록 완료",
  "data": {
    "userId": 6,
    "userName": "강감찬"
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 companyId 추출

-- 1. 현재 상담원 수 확인
SELECT COUNT(*) AS current_count, c.max_agents
FROM users u
JOIN companies c ON u.company_id = c.company_id
WHERE u.company_id = ? AND u.is_active = TRUE;

-- 2. max_agents 초과 체크
IF current_count >= max_agents THEN
  RETURN ERROR: "최대 상담원 수를 초과했습니다."
END IF

-- 3. 상담원 등록
INSERT INTO users (company_id, user_name, user_phone)
VALUES (?, ?, ?);
```

---

### 3. 상담원 삭제 (비활성화)

**Endpoint**: `DELETE /api/company-admin/agents/:userId`

**응답**:
```json
{
  "success": true,
  "message": "상담원이 비활성화되었습니다."
}
```

**백엔드 로직**:
```sql
UPDATE users
SET is_active = FALSE
WHERE user_id = ? AND company_id = ?;
```

---

### 4. DB 업로드 (CSV)

**Endpoint**: `POST /api/company-admin/db-upload`

**요청 (multipart/form-data)**:
- `file`: CSV 파일
- `dbTitle`: DB 제목
- `dbDate`: DB 날짜

**응답**:
```json
{
  "success": true,
  "message": "DB 업로드 완료",
  "data": {
    "dbId": 5,
    "totalCount": 1000,
    "successCount": 998,
    "errorCount": 2
  }
}
```

**백엔드 로직**:
1. CSV 파일 파싱 (EUC-KR 인코딩)
2. db_lists 테이블에 레코드 생성
3. customers 테이블에 일괄 삽입
4. total_count, unused_count 업데이트

---

### 5. DB 할당 (상담원에게)

**Endpoint**: `POST /api/company-admin/db-assign`

**요청**:
```json
{
  "dbId": 1,
  "assignments": [
    { "userId": 1, "count": 200 },
    { "userId": 2, "count": 150 },
    { "userId": 3, "count": 150 }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "message": "DB 할당 완료",
  "data": {
    "dbId": 1,
    "totalAssigned": 500
  }
}
```

**백엔드 로직**:
```sql
-- 각 상담원별로 반복

-- 1. 미사용 고객 조회
SELECT customer_id
FROM customers
WHERE db_id = ? AND data_status = '미사용' AND assigned_user_id IS NULL
LIMIT ?;

-- 2. 고객 할당
UPDATE customers
SET assigned_user_id = ?
WHERE customer_id IN (...);

-- 3. db_assignments 업데이트
INSERT INTO db_assignments (db_id, user_id, company_id, assigned_count)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  assigned_count = assigned_count + ?,
  updated_at = NOW();
```

---

### 6. 업체별 전체 통계

**Endpoint**: `GET /api/company-admin/statistics`

**쿼리 파라미터**:
- `period`: `today` | `week` | `month` | `all`

**응답**:
```json
{
  "success": true,
  "data": {
    "period": "today",
    "companyStats": {
      "totalCallTime": "45:30:00",
      "totalCallCount": 750,
      "successCount": 450,
      "failedCount": 200
    },
    "agentStats": [
      {
        "userId": 1,
        "userName": "홍길동",
        "callCount": 250,
        "callDuration": "15:02:45",
        "successCount": 150
      },
      {
        "userId": 2,
        "userName": "김영희",
        "callCount": 300,
        "callDuration": "18:15:30",
        "successCount": 180
      }
    ]
  }
}
```

**백엔드 로직**:
```sql
-- JWT에서 companyId 추출

SELECT
  u.user_id, u.user_name,
  SUM(s.total_call_count) AS call_count,
  SEC_TO_TIME(SUM(TIME_TO_SEC(s.total_call_time))) AS call_duration,
  SUM(s.success_count) AS success_count
FROM statistics s
JOIN users u ON s.user_id = u.user_id
WHERE s.company_id = ?
  AND s.stat_date >= (조건에 따라)
GROUP BY u.user_id, u.user_name
ORDER BY call_count DESC;
```

---

## 에러 응답 형식

모든 API 에러는 다음 형식을 따릅니다:

```json
{
  "success": false,
  "message": "에러 메시지",
  "errorCode": "ERROR_CODE",
  "details": {} // 선택사항
}
```

**공통 에러 코드**:
- `AUTH_TOKEN_MISSING`: 토큰 없음
- `AUTH_TOKEN_INVALID`: 토큰 유효하지 않음
- `AUTH_TOKEN_EXPIRED`: 토큰 만료
- `AUTH_UNAUTHORIZED`: 권한 없음
- `VALIDATION_ERROR`: 입력 검증 실패
- `NOT_FOUND`: 리소스 없음
- `INTERNAL_ERROR`: 서버 내부 오류

---

## JWT 토큰 구조

**Payload**:
```json
{
  "userId": 1,
  "companyId": 2,
  "userName": "홍길동",
  "role": "agent",
  "iat": 1698012345,
  "exp": 1698098745
}
```

**역할 (role)**:
- `super_admin`: 슈퍼 관리자
- `company_admin`: 업체 관리자
- `agent`: 상담원

---

## 보안 고려사항

1. **업체 격리**: 모든 API는 JWT의 `companyId`로 데이터 필터링
2. **비밀번호 해싱**: SHA2(password, 256)
3. **토큰 만료 시간**: 24시간
4. **HTTPS 필수**: 운영 환경에서 HTTPS만 허용
5. **Rate Limiting**: API 호출 제한 (예: 1분당 100회)
6. **SQL Injection 방지**: Prepared Statement 사용

---

## 다음 단계

1. ✅ API 설계 문서 작성 완료
2. ⏳ Flutter 앱 로그인 화면 수정
3. ⏳ 백엔드 API 구현 (Node.js/Express 또는 Python/FastAPI)
4. ⏳ API 서비스 클래스 작성 (lib/services/api/)
5. ⏳ 업체 관리자 웹페이지 개발
6. ⏳ 슈퍼 관리자 웹페이지 개발
