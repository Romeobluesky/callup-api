# CallUp API 엔드포인트 문서

**최종 업데이트**: 2025-11-01  
**프로젝트**: CallUp 자동 통화 시스템  
**백엔드**: Next.js 15 App Router + MySQL

---

## 목차

1. [인증 체계](#인증-체계)
2. [인증 API](#인증-api)
3. [대시보드 API](#대시보드-api)
4. [자동 통화 API](#자동-통화-api)
5. [고객 관리 API](#고객-관리-api)
6. [DB 리스트 API](#db-리스트-api)
7. [통화 로그 API](#통화-로그-api)
8. [사용자 상태 API](#사용자-상태-api)
9. [상담원 API](#상담원-api) ⭐ **NEW**
10. [녹취파일 관리 API](#녹취파일-관리-api) ⭐ **NEW**
11. [업체 관리자 API](#업체-관리자-api)
12. [주요 변경사항](#주요-변경사항)

---

## 인증 체계

모든 API(로그인 제외)는 JWT 토큰 인증이 필요합니다.

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**JWT Payload**:
```json
{
  "userId": 2,
  "companyId": 1,
  "companyLoginId": "company01",
  "userName": "김상담",
  "role": "agent"
}
```

---

## 인증 API

### POST /api/auth/login

상담원 로그인

**Request**:
```json
{
  "companyLoginId": "company01",
  "companyPassword": "password123",
  "userName": "김상담"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 2,
      "userName": "김상담",
      "userPhone": "010-1234-5678",
      "userStatusMessage": "업무 중",
      "isActive": true,
      "lastLoginAt": "2025-10-31T12:00:00.000Z"
    },
    "company": {
      "companyId": 1,
      "companyLoginId": "company01",
      "companyName": "테스트 업체",
      "maxAgents": 10,
      "isActive": true
    }
  }
}
```

**Errors**:
- 401: 업체 ID/비밀번호 오류
- 403: 비활성 업체/상담원
- 404: 상담원 없음

---

### POST /api/auth/logout

로그아웃 (토큰 무효화는 클라이언트에서 처리)

**Response (200)**:
```json
{
  "success": true,
  "message": "로그아웃 완료",
  "data": null
}
```

---

## 대시보드 API

### GET /api/dashboard

상담원 대시보드 데이터 조회

**Headers**: Authorization 필요

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": 2,
      "userName": "김상담",
      "userPhone": "010-1234-5678",
      "userStatusMessage": "업무 중",
      "isActive": true,
      "lastActiveTime": "2025-10-31T12:00:00"
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
        "dbId": 4,
        "date": "2025-10-31",
        "title": "고객DB_2025_10_31.csv",
        "totalCount": 8,
        "unusedCount": 3
      }
    ]
  }
}
```

**특징**:
- 최근 3개 DB 리스트만 반환
- totalCount, unusedCount는 상담원 배정 고객만 집계
- todayStats는 임시로 0 반환 (테이블 구조 확인 필요)

---

## 자동 통화 API

### POST /api/auto-call/start

⚠️ **앱 개발팀 요청사항 반영**

배정받은 고객 큐 조회

**Headers**: Authorization 필요

**Request**:
```json
{
  "dbId": 4,
  "count": 10
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "고객 큐 조회 성공",
  "data": {
    "customers": [
      {
        "customerId": 4,
        "dbId": 4,
        "name": "홍길동",
        "phone": "010-1111-2222",
        "info1": "30대",
        "info2": "서울",
        "info3": "관심상품A",
        "eventName": "2025년 신규 이벤트",
        "dataStatus": "미사용"
      }
    ],
    "totalCount": 8
  }
}
```

**중요 사항**:
- ⚠️ assigned_user_id = 현재 상담원만 조회
- ⚠️ totalCount는 전체 배정받은 고객 수 (미사용 + 사용완료)
- count 범위: 1~1000

**Errors**:
- 400: 파라미터 오류
- 404: 배정받은 미사용 고객 없음

---

### POST /api/auto-call/log

자동 통화 로그 저장 (부재중, 무응답 등)

**Headers**: Authorization 필요

**Request**:
```json
{
  "customerId": 4,
  "dbId": 4,
  "callResult": "부재중",
  "consultationResult": "부재중",
  "callDuration": "00:00:00"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "통화 로그 저장 완료",
  "data": {
    "logId": 123
  }
}
```

**처리 내용**:
1. call_logs 테이블 INSERT
2. customers 테이블 UPDATE (data_status = 사용완료)

---

### GET /api/auto-call/next-customer

다음 고객 조회 (현재 미사용)

**Query**: dbId

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "customerId": 5,
    "phone": "010-2222-3333",
    "name": "이순신",
    "info1": "40대",
    "info2": "부산",
    "info3": "관심상품B",
    "progress": "2/10"
  }
}
```

---

## 고객 관리 API

### GET /api/customers/{customerId}

고객 상세 정보 조회

**Headers**: Authorization 필요

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "customerId": 4,
    "dbId": 4,
    "assignedUserId": 2,
    "eventName": "2025년 신규 이벤트",
    "phone": "010-1111-2222",
    "name": "홍길동",
    "info1": "30대",
    "info2": "서울",
    "info3": "관심상품A",
    "dataStatus": "사용완료",
    "callResult": "상담완료",
    "consultationResult": "계약 체결",
    "memo": "고객 메모",
    "callDateTime": "2025-10-31 14:30:00",
    "callStartTime": "14:30:00",
    "callEndTime": "14:35:00",
    "callDuration": "00:05:00",
    "reservationDate": "2025-11-01",
    "reservationTime": "10:00",
    "hasAudio": false
  }
}
```

**특징**:
- `hasAudio`: 통화 녹음 파일 존재 여부 (call_logs 테이블 조회)

---

### GET /api/customers/search

고객 검색

**Query**:
- name (부분일치)
- phone (부분일치)
- eventName (부분일치)
- callResult (부분일치)
- page (default: 1)
- limit (default: 20)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "customers": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "limit": 20
    }
  }
}
```

---

## DB 리스트 API

### GET /api/db-lists

DB 리스트 조회

**Query**: search (선택)

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "dbId": 4,
      "companyId": 1,
      "date": "2025-10-31",
      "title": "고객DB_2025_10_31.csv",
      "total": 8,
      "unused": 3,
      "isActive": true
    }
  ]
}
```

**특징**: total, unused는 상담원 배정 고객 기준

---

### GET /api/db-lists/{dbId}/customers

특정 DB의 고객 목록

**Query**:
- status (미사용/사용완료)
- page (default: 1)
- limit (default: 50)

---

### POST /api/db-lists/upload

CSV 파일 업로드

**Content-Type**: multipart/form-data  
**Form Data**: file, title

**CSV 포맷**:
```
이벤트명,전화번호,이름,정보1,정보2,정보3
```

---

### PUT /api/db-lists/{dbId}/toggle

DB 활성화/비활성화

**Request**: { "isActive": false }

---

## 통화 로그 API

### POST /api/call-result

통화 결과 저장 (수동 통화)

**Request**:
```json
{
  "customerId": 4,
  "dbId": 4,
  "callResult": "상담완료",
  "consultationResult": "계약 체결",
  "memo": "고객 메모",
  "callStartTime": "14:30:00",
  "callEndTime": "14:35:00",
  "callDuration": "00:05:00",
  "reservationDate": "2025-11-01",
  "reservationTime": "10:00"
}
```

**처리 내용**:
1. call_logs INSERT
2. customers UPDATE
3. 트랜잭션 처리

---

## 사용자 상태 API

### PUT /api/dashboard/status

상담원 상태 업데이트

**Request**: { "isOn": true }

**처리**:
- isOn: true → 업무 중
- isOn: false → 대기 중

---

### PATCH /api/users/status

상담원 상태/메시지 업데이트

**Request**: { "isActive": true, "statusMessage": "점심 시간" }

---

## 상담원 API

### GET /api/agent/customers

⭐ **NEW** - 상담원에게 분배된 고객 목록 조회

**Headers**: Authorization 필요

**Query Parameters**:
- `dbId` (선택): 특정 DB 리스트 필터링
- `status` (선택): 데이터 상태 필터링 (미사용/사용완료)
- `search` (선택): 고객명 또는 전화번호 검색

**Response (200)**:
```json
{
  "status": "success",
  "data": {
    "total": 10,
    "customers": [
      {
        "customerId": 1,
        "name": "홍길동",
        "phone": "010-1234-5678",
        "info1": "30대",
        "info2": "서울",
        "info3": "관심상품A",
        "status": "미사용",
        "dbId": 5,
        "dbTitle": "2024년 1월 고객 DB",
        "dbDate": "2024-01-15",
        "assignedAt": "2024-01-20 10:30:00",
        "callResult": "연결",
        "consultationResult": "상담완료",
        "callDateTime": "2024-01-25 14:30:00",
        "callDuration": "180",
        "memo": "재상담 필요",
        "hasAudio": true
      }
    ]
  }
}
```

**특징**:
- 로그인한 상담원에게 **관리자가 분배한 고객만** 조회
- 통화 이력 정보 포함 (callResult, consultationResult, memo 등)
- `hasAudio`: 통화 녹음 파일 존재 여부
- 필터링 및 검색 기능 지원

**사용 예시**:
```
GET /api/agent/customers                    // 전체 조회
GET /api/agent/customers?dbId=5             // DB별 조회
GET /api/agent/customers?status=미사용       // 상태별 조회
GET /api/agent/customers?search=홍길동       // 검색
```

---

## 녹취파일 관리 API

### POST /api/recordings/upload

⭐ **NEW** - 녹취파일 자동 업로드 (앱 → API)

**Headers**: Authorization 필요

**Content-Type**: multipart/form-data

**Form Data**:
- `file`: 녹취파일 (File, 필수)
- `phoneNumber`: 전화번호 (string, 필수) - 발신 또는 수신 번호
- `recordedAt`: 녹음 시각 (string, 필수) - ISO 8601 형식 (예: "2025-01-15T14:30:52Z")
- `duration`: 녹음 시간(초) (number, 선택)

**동작 방식**:
1. `phoneNumber`와 `recordedAt` 기준으로 call_logs 테이블에서 통화 기록 검색 (±5분 오차 허용)
2. 통화 기록이 없으면 customers 테이블에서 전화번호로 고객 검색
3. call_logs 테이블 업데이트 (통화 기록이 있는 경우)
4. customers 테이블 업데이트 (has_audio, audio_file_path)

**Response (200)**:
```json
{
  "success": true,
  "message": "녹취파일 업로드 완료",
  "data": {
    "phoneNumber": "01012345678",
    "recordedAt": "2025-01-15T14:30:52Z",
    "fileName": "01012345678_20250115143052_101.m4a",
    "fileSize": 2048576,
    "duration": 180,
    "uploadedAt": "2025-01-15T14:31:00Z"
  }
}
```

**Response (413 - File Too Large)**:
```json
{
  "success": false,
  "message": "파일 크기는 50MB를 초과할 수 없습니다.",
  "code": "FILE_TOO_LARGE"
}
```

**파일 저장 구조**:
```
/storage/recordings/
  └── company_{companyId}/           # 업체별
      └── {YYYY-MM}/                 # 년-월별
          └── {YYYYMMDD}/            # 일자별
              └── {phone}_{timestamp}_{logId}.{ext}  (통화 기록 있는 경우)
              └── {phone}_{timestamp}.{ext}          (통화 기록 없는 경우)
```

**파일 검증**:
- 허용 형식: m4a, mp3, amr, 3gp, wav, aac
- 최대 크기: 50MB (초과 시 413 에러)
- 중복 업로드 방지 (call_log 기준)

---

### GET /api/recordings/check-exists/{logId}

⭐ **NEW** - 녹취파일 존재 여부 확인

**Headers**: Authorization 필요

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "exists": true,
    "logId": 101,
    "uploadedAt": "2025-01-15T14:30:52Z"
  }
}
```

---

### GET /api/recordings/{logId}/stream

⭐ **NEW** - 녹취파일 스트리밍 재생

**Headers**: Authorization 필요

**Response**: Audio Stream
```
Content-Type: audio/mp4
Content-Disposition: inline
Accept-Ranges: bytes
Cache-Control: public, max-age=86400
```

**특징**:
- 브라우저에서 직접 재생 가능
- Range Request 지원 (부분 재생)
- 캐싱 지원 (24시간)

---

### GET /api/recordings/{logId}/download

⭐ **NEW** - 녹취파일 다운로드

**Headers**: Authorization 필요

**Response**: File Download
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="..."
```

---

### GET /api/admin/recordings

⭐ **NEW** - 녹취 목록 조회 (관리자)

**Headers**: Authorization 필요

**Role**: company_admin, super_admin

**Query Parameters**:
- `dateFrom`: 시작일 (YYYY-MM-DD, 선택)
- `dateTo`: 종료일 (YYYY-MM-DD, 선택)
- `userId`: 상담원 ID (선택)
- `customerId`: 고객 ID (선택)
- `hasAudio`: 녹취 존재 여부 (true/false, 선택)
- `page`: 페이지 번호 (default: 1)
- `limit`: 페이지당 항목 수 (default: 20, max: 100)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "recordings": [
      {
        "logId": 101,
        "companyId": 1,
        "userId": 2,
        "userName": "김상담",
        "customerId": 50,
        "customerName": "홍길동",
        "customerPhone": "010-8765-4321",
        "callResult": "연결",
        "callDateTime": "2025-01-15T14:30:00Z",
        "audioDuration": 180,
        "audioFileSize": 2048576,
        "audioFormat": "m4a",
        "originalFilename": "recording.m4a",
        "uploadedAt": "2025-01-15T14:30:52Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

---

### DELETE /api/admin/recordings/{logId}

⭐ **NEW** - 녹취파일 삭제 (관리자)

**Headers**: Authorization 필요

**Role**: company_admin, super_admin

**Response (200)**:
```json
{
  "success": true,
  "message": "녹취파일이 삭제되었습니다.",
  "data": {
    "logId": 101,
    "deleted": true
  }
}
```

**처리 내용**:
1. 파일 시스템에서 파일 삭제
2. call_logs 테이블 업데이트 (has_audio = FALSE)

---

### GET /api/admin/recordings/stats

⭐ **NEW** - 녹취 통계 조회 (관리자)

**Headers**: Authorization 필요

**Role**: company_admin, super_admin

**Query Parameters**:
- `dateFrom`: 시작일 (YYYY-MM-DD, 선택)
- `dateTo`: 종료일 (YYYY-MM-DD, 선택)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "totalRecordings": 1500,
    "totalSize": 3221225472,
    "totalDuration": 45000,
    "byStatus": {
      "completed": 1450,
      "failed": 30,
      "pending": 15,
      "uploading": 5
    },
    "byFormat": {
      "m4a": 1200,
      "mp3": 250,
      "amr": 50
    }
  }
}
```

**응답 필드 설명**:
- `totalSize`: 바이트 단위 (3GB = 3,221,225,472 bytes)
- `totalDuration`: 초 단위 (45,000초 = 12.5시간)

---

## 업체 관리자 API

### GET /api/company-admin/agents

상담원 목록 조회

**Role**: company_admin, super_admin

---

### POST /api/company-admin/agents

상담원 등록

**Request**: { "userName": "이상담", "userPhone": "010-9999-8888" }

---

### DELETE /api/company-admin/agents/{userId}

상담원 비활성화

---

### POST /api/company-admin/db-assign

DB 고객 할당

**Request**:
```json
{
  "dbId": 4,
  "assignments": [
    { "userId": 2, "count": 50 },
    { "userId": 3, "count": 30 }
  ]
}
```

**처리**:
1. 미배정 미사용 고객 조회
2. assigned_user_id 업데이트
3. db_assignments 테이블 업데이트
4. 트랜잭션 처리

---

## 주요 변경사항

### ⭐ NEW (2025-11-01): 녹취파일 관리 시스템 추가

**목적**: 오토콜 앱의 통화 녹취파일 자동 업로드 및 관리자 페이지에서의 녹취 관리

**데이터베이스 변경사항**:
- `call_logs` 테이블에 8개 컬럼 추가
  - `has_audio`: 녹음 파일 존재 여부
  - `audio_file_path`: 파일 저장 경로
  - `audio_file_size`: 파일 크기 (바이트)
  - `audio_duration`: 녹음 시간 (초)
  - `audio_format`: 파일 형식 (m4a, mp3, amr)
  - `original_filename`: 원본 파일명
  - `uploaded_at`: 업로드 시간
  - `upload_status`: 업로드 상태 (pending, uploading, completed, failed)
- 성능 최적화를 위한 4개 인덱스 추가

**파일 저장 구조**:
```
/storage/recordings/
  └── company_{companyId}/     # 업체별
      └── {YYYY-MM}/            # 년-월별
          └── {YYYYMMDD}/       # 일자별
              └── {caller}_{receiver}_{timestamp}_{logId}.{ext}
```

**신규 API 엔드포인트** (총 6개):
1. `POST /api/recordings/upload` - 녹취파일 업로드 (앱용)
2. `GET /api/recordings/check-exists/{logId}` - 중복 업로드 방지
3. `GET /api/recordings/{logId}/stream` - 스트리밍 재생
4. `GET /api/recordings/{logId}/download` - 파일 다운로드
5. `GET /api/admin/recordings` - 녹취 목록 조회 (관리자)
6. `DELETE /api/admin/recordings/{logId}` - 녹취파일 삭제 (관리자)
7. `GET /api/admin/recordings/stats` - 녹취 통계 조회 (관리자)

**보안 및 검증**:
- 파일 형식 검증: m4a, mp3, amr만 허용
- 파일 크기 제한: 최대 100MB
- JWT 토큰 인증 (모든 API)
- 업체별 데이터 격리 (company_id 검증)
- 관리자 권한 검증 (company_admin, super_admin)

---

### ⭐ NEW (2025-11-01): 상담원 전용 고객 조회 API 추가

**엔드포인트**: `GET /api/agent/customers`

**목적**: 앱 개발팀 요청 - 상담원이 자신에게 분배된 고객 목록을 조회할 수 있는 전용 API

**주요 기능**:
- 로그인한 상담원에게 관리자가 분배한 고객만 조회 (`assigned_user_id` 필터링)
- 통화 이력 정보 포함 (callResult, consultationResult, callDateTime, memo, hasAudio)
- DB별 필터링, 상태별 필터링, 검색 기능 지원

**데이터 출처**:
- 고객 기본정보 및 통화정보: `customers` 테이블
- DB 정보: `db_lists` 테이블 (LEFT JOIN)
- 녹음 파일 여부: `call_logs` 테이블 (LEFT JOIN)

---

### 1. company_id → company_login_id 마이그레이션

모든 API에서 company_login_id 사용:
- users.company_login_id
- db_lists.company_login_id
- call_logs.company_login_id

### 2. 상담원별 고객 필터링

다음 API는 배정된 고객만 조회:
- /api/dashboard
- /api/db-lists
- /api/auto-call/start
- **/api/agent/customers** ⭐ NEW

### 3. totalCount 수정

/api/auto-call/start:
- 이전: 미사용 고객 수
- 현재: 전체 배정받은 고객 수
- 목적: 진행률 "6/8" 표시

### 4. LIMIT 파라미터 처리

⚠️ **중요**: MySQL prepared statement는 LIMIT/OFFSET 바인딩을 지원하지 않음

**적용된 API**:
- `/api/auto-call/start`
- `/api/customers/search`
- `/api/db-lists/{dbId}/customers`
- `/api/company-admin/db-assign`

**처리 방식**:
```typescript
// Safe integer validation (SQL injection prevention)
const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')))
const offset = Math.max(0, (page - 1) * limit)

// Direct insertion (NOT parameter binding)
const query = `SELECT * FROM table LIMIT ${limit} OFFSET ${offset}`
```

**보안 고려사항**:
- `Math.max/Math.min`으로 범위 제한 (SQL injection 방지)
- `parseInt`로 정수 변환 강제
- 직접 삽입 방식이지만 검증된 안전한 정수만 사용

---

## 보안 사항

1. JWT 토큰 검증 (authenticate 함수)
2. company_login_id 기반 데이터 격리
3. 역할 기반 접근 제어
4. SQL Injection 방지 (Prepared statements)
5. 입력값 유효성 검사

---

## 개발 환경

- Framework: Next.js 15 App Router
- Database: MySQL (mysql2)
- Auth: JWT (jsonwebtoken)
- File Upload: iconv-lite (EUC-KR)

---

**문의**: 백엔드 개발팀
