# CallUp API 엔드포인트 문서

**최종 업데이트**: 2025-10-31  
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
9. [업체 관리자 API](#업체-관리자-api)
10. [주요 변경사항](#주요-변경사항)

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

### 3. totalCount 수정

/api/auto-call/start:
- 이전: 미사용 고객 수
- 현재: 전체 배정받은 고객 수
- 목적: 진행률 "6/8" 표시

### 4. LIMIT 파라미터 처리

MySQL prepared statement 제약:
```typescript
const limit = Math.max(1, Math.min(1000, parseInt(String(count))))
// SQL: LIMIT ${limit}
```

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
