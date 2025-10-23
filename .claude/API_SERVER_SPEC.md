# CallUp API 서버 사양서

## 개요

CallUp 모바일 자동 통화 애플리케이션을 위한 RESTful API 서버 사양서입니다.

**기술 스택 권장사항**:
- **Backend Framework**: Node.js + Express / Spring Boot / Laravel
- **Database**: MySQL 8.0+
- **Authentication**: JWT (JSON Web Token)
- **API Documentation**: Swagger/OpenAPI 3.0

---

## 데이터베이스 스키마

**참고**: `DATABASE_SCHEMA.md` 파일의 스키마를 그대로 사용

**주요 테이블**:
1. `users` - 상담원 정보
2. `db_lists` - DB 리스트 (CSV 파일 메타데이터)
3. `customers` - 고객 정보 (CSV 데이터)
4. `call_logs` - 통화 기록
5. `statistics` - 일별 통계

---

## 인증 시스템

### 1. 로그인 (POST /api/auth/login)

**Request**:
```json
{
  "userId": "admin01",
  "userName": "김상담",
  "password": "password123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "userId": "admin01",
    "userName": "김상담",
    "phone": "010-1234-5678",
    "statusMessage": "오늘은 대박나는 날~!!",
    "isActive": true
  }
}
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "message": "아이디 또는 비밀번호가 일치하지 않습니다."
}
```

**SQL 쿼리**:
```sql
SELECT user_id, user_name, phone, status_message, is_active, password_hash
FROM users
WHERE user_id = ? AND user_name = ?;
```

**구현 로직**:
1. 입력된 userId, userName으로 사용자 조회
2. bcrypt로 비밀번호 해시 비교
3. 일치하면 JWT 토큰 생성 (유효기간: 7일)
4. 사용자 정보와 토큰 반환

---

## 대시보드 API

### 2. 대시보드 데이터 조회 (GET /api/dashboard)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": 1,
      "userName": "김상담",
      "phone": "010-1234-5678",
      "statusMessage": "오늘은 대박나는 날~!!",
      "isActive": true,
      "lastActiveTime": "2025-10-22T14:15:25"
    },
    "todayStats": {
      "callCount": 125,
      "callDuration": "05:20:15"
    },
    "callResults": {
      "connected": 100,
      "failed": 25,
      "callback": 10
    },
    "dbLists": [
      {
        "dbId": 1,
        "date": "2025-10-20",
        "title": "테스트01_인천",
        "totalCount": 8,
        "unusedCount": 8
      },
      {
        "dbId": 2,
        "date": "2025-10-14",
        "title": "이벤트01_251014",
        "totalCount": 500,
        "unusedCount": 250
      },
      {
        "dbId": 3,
        "date": "2025-10-12",
        "title": "서울경기_251012",
        "totalCount": 500,
        "unusedCount": 420
      }
    ]
  }
}
```

**SQL 쿼리**:

```sql
-- 1. 사용자 정보
SELECT user_id, user_name, phone, status_message, is_active, updated_at AS last_active_time
FROM users
WHERE user_id = ?;

-- 2. 오늘 통계
SELECT call_count, call_duration
FROM statistics
WHERE user_id = ? AND stat_date = CURDATE();

-- 3. 오늘 통화 결과 집계
SELECT
  SUM(CASE WHEN call_result LIKE '%연결성공%' OR call_result LIKE '%통화성공%' THEN 1 ELSE 0 END) AS connected,
  SUM(CASE WHEN call_result LIKE '%연결실패%' OR call_result LIKE '%부재중%' OR call_result LIKE '%무응답%' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN call_result LIKE '%재연락%' OR call_result LIKE '%재통화%' THEN 1 ELSE 0 END) AS callback
FROM call_logs
WHERE user_id = ? AND DATE(call_datetime) = CURDATE();

-- 4. DB 리스트 (최근 3개)
SELECT
  db_id,
  upload_date AS date,
  file_name AS title,
  total_count,
  unused_count
FROM db_lists
WHERE user_id = ?
ORDER BY upload_date DESC
LIMIT 3;
```

---

### 3. 사용자 상태 업데이트 (PATCH /api/users/status)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Request**:
```json
{
  "isActive": true,
  "statusMessage": "오늘은 대박나는 날~!!"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "상태가 업데이트되었습니다."
}
```

**SQL 쿼리**:
```sql
UPDATE users
SET is_active = ?,
    status_message = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = ?;
```

---

## DB 리스트 API

### 4. DB 리스트 전체 조회 (GET /api/db-lists)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters**:
- `search` (optional): 제목 검색어

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "dbId": 1,
      "date": "2025-10-20",
      "title": "테스트01_인천",
      "fileName": "customers.csv",
      "totalCount": 8,
      "unusedCount": 8
    },
    {
      "dbId": 2,
      "date": "2025-10-14",
      "title": "이벤트01_251014",
      "fileName": "event01_251014.csv",
      "totalCount": 500,
      "unusedCount": 250
    }
  ]
}
```

**SQL 쿼리**:
```sql
-- 검색어가 없는 경우
SELECT db_id, upload_date AS date, file_name AS title, file_name, total_count, unused_count
FROM db_lists
WHERE user_id = ?
ORDER BY upload_date DESC;

-- 검색어가 있는 경우
SELECT db_id, upload_date AS date, file_name AS title, file_name, total_count, unused_count
FROM db_lists
WHERE user_id = ? AND file_name LIKE CONCAT('%', ?, '%')
ORDER BY upload_date DESC;
```

---

### 5. DB 선택 및 고객 목록 조회 (GET /api/db-lists/:dbId/customers)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters**:
- `status` (optional): 데이터상태 필터 (`미사용`, `사용완료`)
- `page` (optional): 페이지 번호 (기본값: 1)
- `limit` (optional): 페이지당 개수 (기본값: 50)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "dbInfo": {
      "dbId": 1,
      "title": "테스트01_인천",
      "totalCount": 8,
      "unusedCount": 8
    },
    "customers": [
      {
        "customerId": 1,
        "phone": "010-1234-5678",
        "name": "홍길동",
        "info1": "인천 부평구",
        "info2": "쿠팡 이벤트",
        "info3": "",
        "dataStatus": "미사용"
      },
      {
        "customerId": 2,
        "phone": "010-2345-6789",
        "name": "김철수",
        "info1": "서울 강남구",
        "info2": "네이버 이벤트",
        "info3": "",
        "dataStatus": "미사용"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 8,
      "limit": 50
    }
  }
}
```

**SQL 쿼리**:
```sql
-- DB 정보
SELECT db_id, file_name AS title, total_count, unused_count
FROM db_lists
WHERE db_id = ? AND user_id = ?;

-- 고객 목록 (페이지네이션)
SELECT
  customer_id,
  customer_phone AS phone,
  customer_name AS name,
  customer_info1 AS info1,
  customer_info2 AS info2,
  customer_info3 AS info3,
  data_status
FROM customers
WHERE db_id = ?
  AND (? IS NULL OR data_status = ?)
ORDER BY customer_id ASC
LIMIT ? OFFSET ?;

-- 총 개수
SELECT COUNT(*) AS total
FROM customers
WHERE db_id = ?
  AND (? IS NULL OR data_status = ?);
```

---

## 자동 통화 API

### 6. 다음 고객 가져오기 (GET /api/auto-call/next-customer)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters**:
- `dbId` (required): DB ID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "customerId": 1,
    "phone": "010-1234-5678",
    "name": "홍길동",
    "info1": "인천 부평구",
    "info2": "쿠팡 이벤트",
    "info3": "",
    "progress": "1/8"
  }
}
```

**Response (404 Not Found - 더 이상 미사용 고객 없음)**:
```json
{
  "success": false,
  "message": "모든 고객에 대한 통화가 완료되었습니다."
}
```

**SQL 쿼리**:
```sql
-- 미사용 고객 1명 가져오기
SELECT
  customer_id,
  customer_phone AS phone,
  customer_name AS name,
  customer_info1 AS info1,
  customer_info2 AS info2,
  customer_info3 AS info3
FROM customers
WHERE db_id = ? AND data_status = '미사용'
ORDER BY customer_id ASC
LIMIT 1;

-- 진행률 계산
SELECT
  (total_count - unused_count) AS completed,
  total_count
FROM db_lists
WHERE db_id = ?;
```

---

### 7. 통화 결과 등록 (POST /api/call-logs)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Request**:
```json
{
  "customerId": 1,
  "dbId": 1,
  "callResult": "통화성공",
  "consultationResult": "구매 의사 있음",
  "memo": "다음주에 다시 통화하기로 함",
  "callStartTime": "2025-10-22T14:30:00",
  "callEndTime": "2025-10-22T14:35:24",
  "callDuration": "00:05:24",
  "reservationDate": "2025-10-29",
  "reservationTime": "14:00:00"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "통화 결과가 저장되었습니다.",
  "callLogId": 123
}
```

**SQL 쿼리**:
```sql
-- 1. call_logs 테이블에 기록 추가
INSERT INTO call_logs (
  user_id,
  customer_id,
  db_id,
  call_result,
  consultation_result,
  memo,
  call_datetime,
  call_start_time,
  call_end_time,
  call_duration,
  reservation_date,
  reservation_time
) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?);

-- 2. customers 테이블의 통화 정보 업데이트 (트리거가 자동 처리)
-- 또는 수동으로:
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

-- 3. db_lists의 unused_count 업데이트 (트리거가 자동 처리)
-- 또는 수동으로:
UPDATE db_lists
SET unused_count = unused_count - 1
WHERE db_id = ?;

-- 4. statistics 테이블 업데이트 (트리거가 자동 처리)
-- 또는 수동으로:
INSERT INTO statistics (user_id, stat_date, call_count, call_duration)
VALUES (?, CURDATE(), 1, TIME_TO_SEC(?))
ON DUPLICATE KEY UPDATE
  call_count = call_count + 1,
  call_duration = SEC_TO_TIME(TIME_TO_SEC(call_duration) + TIME_TO_SEC(?));
```

---

## 고객 검색 API

### 8. 고객 검색 (GET /api/customers/search)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters**:
- `name` (optional): 고객명
- `phone` (optional): 전화번호
- `eventName` (optional): 이벤트명
- `callResult` (optional): 통화결과
- `page` (optional): 페이지 번호 (기본값: 1)
- `limit` (optional): 페이지당 개수 (기본값: 20)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customerId": 1,
        "date": "2025-10-20",
        "eventName": "테스트01_인천",
        "name": "홍길동",
        "phone": "010-1234-5678",
        "callStatus": "통화성공",
        "callDateTime": "2025-10-22T14:35:24",
        "callDuration": "00:05:24",
        "customerType": "가망고객",
        "memo": "다음주에 다시 통화하기로 함",
        "hasAudio": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "limit": 20
    }
  }
}
```

**SQL 쿼리**:
```sql
SELECT
  c.customer_id,
  dl.upload_date AS date,
  c.event_name,
  c.customer_name AS name,
  c.customer_phone AS phone,
  c.call_result AS call_status,
  c.call_datetime,
  c.call_duration,
  '' AS customer_type,  -- 고객유형은 삭제됨
  c.memo,
  FALSE AS has_audio  -- 추후 녹음 기능 구현 시 수정
FROM customers c
JOIN db_lists dl ON c.db_id = dl.db_id
WHERE dl.user_id = ?
  AND (? IS NULL OR c.customer_name LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR c.customer_phone LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR c.event_name LIKE CONCAT('%', ?, '%'))
  AND (? IS NULL OR c.call_result LIKE CONCAT('%', ?, '%'))
ORDER BY c.call_datetime DESC
LIMIT ? OFFSET ?;
```

---

### 9. 고객 상세 조회 (GET /api/customers/:customerId)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "customerId": 1,
    "dbId": 1,
    "eventName": "테스트01_인천",
    "phone": "010-1234-5678",
    "name": "홍길동",
    "info1": "인천 부평구",
    "info2": "쿠팡 이벤트",
    "info3": "",
    "dataStatus": "사용완료",
    "callResult": "통화성공",
    "consultationResult": "구매 의사 있음",
    "memo": "다음주에 다시 통화하기로 함",
    "callDateTime": "2025-10-22T14:35:24",
    "callStartTime": "14:30:00",
    "callEndTime": "14:35:24",
    "callDuration": "00:05:24",
    "reservationDate": "2025-10-29",
    "reservationTime": "14:00:00",
    "uploadDate": "2025-10-20",
    "lastModifiedDate": "2025-10-22T14:35:24"
  }
}
```

**SQL 쿼리**:
```sql
SELECT
  customer_id,
  db_id,
  event_name,
  customer_phone AS phone,
  customer_name AS name,
  customer_info1 AS info1,
  customer_info2 AS info2,
  customer_info3 AS info3,
  data_status,
  call_result,
  consultation_result,
  memo,
  call_datetime,
  call_start_time,
  call_end_time,
  call_duration,
  reservation_date,
  reservation_time,
  upload_date,
  last_modified_date
FROM customers
WHERE customer_id = ?;
```

---

## 통계 API

### 10. 통계 조회 (GET /api/statistics)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters**:
- `period` (required): `today`, `week`, `month`, `all`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "period": "today",
    "callDuration": "15:02:45",
    "callCount": 250,
    "connected": 120,
    "failed": 80,
    "promising": 50,
    "callback": 30,
    "noAnswer": 50,
    "totalDb": 500,
    "unusedDb": 250
  }
}
```

**SQL 쿼리**:

```sql
-- today
SELECT
  SUM(call_count) AS call_count,
  SEC_TO_TIME(SUM(TIME_TO_SEC(call_duration))) AS call_duration
FROM statistics
WHERE user_id = ? AND stat_date = CURDATE();

-- week
SELECT
  SUM(call_count) AS call_count,
  SEC_TO_TIME(SUM(TIME_TO_SEC(call_duration))) AS call_duration
FROM statistics
WHERE user_id = ?
  AND stat_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
  AND stat_date <= CURDATE();

-- month
SELECT
  SUM(call_count) AS call_count,
  SEC_TO_TIME(SUM(TIME_TO_SEC(call_duration))) AS call_duration
FROM statistics
WHERE user_id = ?
  AND YEAR(stat_date) = YEAR(CURDATE())
  AND MONTH(stat_date) = MONTH(CURDATE());

-- all
SELECT
  SUM(call_count) AS call_count,
  SEC_TO_TIME(SUM(TIME_TO_SEC(call_duration))) AS call_duration
FROM statistics
WHERE user_id = ?;

-- 통화 결과 집계 (period에 따라 날짜 조건 추가)
SELECT
  SUM(CASE WHEN call_result LIKE '%통화성공%' THEN 1 ELSE 0 END) AS connected,
  SUM(CASE WHEN call_result LIKE '%연결실패%' OR call_result LIKE '%부재중%' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN consultation_result LIKE '%가망고객%' THEN 1 ELSE 0 END) AS promising,
  SUM(CASE WHEN call_result LIKE '%재연락%' THEN 1 ELSE 0 END) AS callback,
  SUM(CASE WHEN call_result LIKE '%무응답%' THEN 1 ELSE 0 END) AS no_answer
FROM call_logs
WHERE user_id = ?
  AND (
    (? = 'today' AND DATE(call_datetime) = CURDATE()) OR
    (? = 'week' AND call_datetime >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)) OR
    (? = 'month' AND YEAR(call_datetime) = YEAR(CURDATE()) AND MONTH(call_datetime) = MONTH(CURDATE())) OR
    (? = 'all')
  );

-- DB 개수
SELECT
  SUM(total_count) AS total_db,
  SUM(unused_count) AS unused_db
FROM db_lists
WHERE user_id = ?;
```

---

## CSV 파일 업로드 API

### 11. CSV 파일 업로드 (POST /api/db-lists/upload)

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data
```

**Request (Form Data)**:
- `file`: CSV 파일 (EUC-KR 인코딩)
- `title`: DB 제목 (optional, 없으면 파일명 사용)

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "CSV 파일이 업로드되었습니다.",
  "data": {
    "dbId": 5,
    "fileName": "event_20251022.csv",
    "totalCount": 500,
    "uploadDate": "2025-10-22"
  }
}
```

**처리 로직**:
1. CSV 파일 EUC-KR → UTF-8 변환
2. CSV 파싱 (컬럼 매핑: DATABASE_SCHEMA.md 참고)
3. `db_lists` 테이블에 메타데이터 저장
4. `customers` 테이블에 고객 데이터 Bulk Insert
5. `total_count`, `unused_count` 계산 및 저장

**SQL 쿼리**:
```sql
-- 1. db_lists 테이블에 메타데이터 추가
INSERT INTO db_lists (user_id, file_name, upload_date, total_count, unused_count)
VALUES (?, ?, CURDATE(), ?, ?);

-- 2. customers 테이블에 고객 데이터 Bulk Insert
INSERT INTO customers (
  db_id,
  event_name,
  customer_phone,
  customer_name,
  customer_info1,
  customer_info2,
  customer_info3,
  data_status,
  upload_date
) VALUES
(?, ?, ?, ?, ?, ?, ?, '미사용', CURDATE()),
(?, ?, ?, ?, ?, ?, ?, '미사용', CURDATE()),
...;
```

---

## 에러 응답 형식

**공통 에러 응답**:
```json
{
  "success": false,
  "message": "에러 메시지",
  "errorCode": "ERROR_CODE"
}
```

**HTTP 상태 코드**:
- `200 OK`: 성공
- `201 Created`: 생성 성공
- `400 Bad Request`: 잘못된 요청
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스 없음
- `500 Internal Server Error`: 서버 에러

**에러 코드 예시**:
- `INVALID_TOKEN`: 유효하지 않은 토큰
- `EXPIRED_TOKEN`: 만료된 토큰
- `INVALID_CREDENTIALS`: 잘못된 인증 정보
- `USER_NOT_FOUND`: 사용자를 찾을 수 없음
- `DB_NOT_FOUND`: DB를 찾을 수 없음
- `CUSTOMER_NOT_FOUND`: 고객을 찾을 수 없음
- `NO_UNUSED_CUSTOMERS`: 미사용 고객 없음
- `FILE_UPLOAD_FAILED`: 파일 업로드 실패
- `CSV_PARSE_ERROR`: CSV 파싱 에러

---

## 보안 고려사항

### JWT 인증
- **토큰 유효기간**: 7일
- **Refresh Token**: 30일 (선택사항)
- **Secret Key**: 환경변수로 관리 (절대 하드코딩 금지)

### 비밀번호 해싱
- **알고리즘**: bcrypt (cost factor: 10-12)
- **절대 평문 저장 금지**

### SQL Injection 방지
- **Prepared Statements** 사용 (Parameterized Query)
- **사용자 입력 검증** (Validation)

### CORS 설정
- **허용 Origin**: Flutter 앱의 요청만 허용
- **개발 환경**: `*` 허용
- **프로덕션**: 특정 도메인만 허용

### Rate Limiting
- **API 호출 제한**: 사용자당 분당 100회
- **로그인 시도 제한**: IP당 시간당 5회

---

## 성능 최적화

### 인덱스
- `customers.data_status` (미사용 고객 빠른 조회)
- `customers.db_id` (DB별 고객 조회)
- `call_logs.user_id, call_logs.call_datetime` (통계 조회)
- `statistics.user_id, statistics.stat_date` (통계 조회)

### 캐싱
- **Redis**: 대시보드 데이터 캐싱 (TTL: 30초)
- **세션 관리**: JWT 토큰 블랙리스트

### 페이지네이션
- **기본값**: 20개/페이지
- **최대값**: 100개/페이지
- **Offset 기반** 또는 **Cursor 기반**

---

## 배포 환경 설정

### 환경변수 (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=callup_db
DB_USER=callup_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_characters
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### 서버 구성
- **Node.js**: PM2로 프로세스 관리
- **Nginx**: 리버스 프록시, SSL 인증서
- **MySQL**: Master-Slave 복제 (선택사항)
- **Redis**: 캐싱 및 세션 관리 (선택사항)

---

## 테스트

### API 테스트 도구
- **Postman**: API 테스트 컬렉션 작성
- **Jest**: 유닛 테스트 및 통합 테스트
- **Supertest**: Express API 테스트

### 테스트 시나리오
1. 로그인 → 대시보드 조회
2. DB 리스트 조회 → DB 선택 → 고객 목록 조회
3. 자동 통화 → 다음 고객 가져오기 → 통화 결과 등록
4. 고객 검색 → 고객 상세 조회
5. 통계 조회 (오늘/이번주/이번달/전체)

---

## 향후 확장 기능

### 1단계 (필수)
- [x] 인증 시스템 (로그인, JWT)
- [x] 대시보드 API
- [x] DB 리스트 관리
- [x] 자동 통화 API
- [x] 고객 검색
- [x] 통계 API

### 2단계 (선택)
- [ ] 통화 녹음 파일 업로드/다운로드
- [ ] 실시간 통계 (WebSocket)
- [ ] 관리자 권한 관리
- [ ] CSV 파일 다운로드 (엑셀 내보내기)
- [ ] 푸시 알림 (FCM)

### 3단계 (고급)
- [ ] 다중 사용자 협업 (팀 관리)
- [ ] 데이터 분석 대시보드
- [ ] AI 기반 통화 추천
- [ ] 음성인식 (STT) 통화 내용 자동 기록

---

## 참고 문서

- **데이터베이스 스키마**: `DATABASE_SCHEMA.md`
- **프로젝트 문서**: `CLAUDE.md`
- **Flutter 앱 구조**: `lib/screens/`, `lib/services/`

---

**작성일**: 2025-10-22
**버전**: 1.0.0
