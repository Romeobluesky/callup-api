# CallUp API Endpoints

## Base URL
```
https://api.autocallup.com
```

## Authentication
Most endpoints require JWT token in the Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 1. Authentication

### POST /api/auth/login
로그인

**Request Body:**
```json
{
  "userId": "admin01",
  "userName": "김상담",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
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
}
```

---

## 2. Dashboard

### GET /api/dashboard
대시보드 데이터 조회

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK):**
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
      }
    ]
  }
}
```

---

## 3. User Status

### PATCH /api/users/status
사용자 상태 업데이트

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "isActive": true,
  "statusMessage": "오늘은 대박나는 날~!!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "상태가 업데이트되었습니다.",
  "data": {
    "updated": true
  }
}
```

---

## 4. DB Lists

### GET /api/db-lists
DB 리스트 전체 조회

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `search` (optional): 제목 검색어

**Response (200 OK):**
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
    }
  ]
}
```

### GET /api/db-lists/:dbId/customers
DB 선택 및 고객 목록 조회

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `status` (optional): '미사용' or '사용완료'
- `page` (optional): 페이지 번호 (default: 1)
- `limit` (optional): 페이지당 개수 (default: 50)

**Response (200 OK):**
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

---

## 5. Auto Call

### GET /api/auto-call/next-customer
다음 고객 가져오기

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `dbId` (required): DB ID

**Response (200 OK):**
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

---

## 6. Call Logs

### POST /api/call-logs
통화 결과 등록

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "customerId": 1,
  "dbId": 1,
  "callResult": "통화성공",
  "consultationResult": "구매 의사 있음",
  "memo": "다음주에 다시 통화하기로 함",
  "callStartTime": "14:30:00",
  "callEndTime": "14:35:24",
  "callDuration": "00:05:24",
  "reservationDate": "2025-10-29",
  "reservationTime": "14:00:00"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "통화 결과가 저장되었습니다.",
  "data": {
    "callLogId": 123
  }
}
```

---

## 7. Customer Search

### GET /api/customers/search
고객 검색

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `name` (optional): 고객명
- `phone` (optional): 전화번호
- `eventName` (optional): 이벤트명
- `callResult` (optional): 통화결과
- `page` (optional): 페이지 번호 (default: 1)
- `limit` (optional): 페이지당 개수 (default: 20)

**Response (200 OK):**
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
        "customerType": "",
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

### GET /api/customers/:customerId
고객 상세 조회

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK):**
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

---

## 8. Statistics

### GET /api/statistics
통계 조회

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `period` (required): 'today', 'week', 'month', 'all'

**Response (200 OK):**
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

---

## 9. CSV Upload

### POST /api/db-lists/upload
CSV 파일 업로드

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: CSV 파일 (EUC-KR or UTF-8 인코딩)
- `title` (optional): DB 제목 (없으면 파일명 사용)

**CSV Format:**
```
이벤트명,전화번호,고객명,고객정보1,고객정보2,고객정보3
테스트이벤트,010-1234-5678,홍길동,서울 강남구,쿠팡 이벤트,#1001
```

**Response (200 OK):**
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

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "에러 메시지",
  "errorCode": "ERROR_CODE"
}
```

**Common Error Codes:**
- `UNAUTHORIZED` (401): 인증이 필요합니다
- `FORBIDDEN` (403): 권한이 없습니다
- `NOT_FOUND` (404): 리소스를 찾을 수 없습니다
- `INVALID_CREDENTIALS` (401): 잘못된 인증 정보
- `MISSING_FIELDS` (400): 필수 정보 누락
- `INVALID_DB_ID` (400): 유효하지 않은 DB ID
- `INVALID_CUSTOMER_ID` (400): 유효하지 않은 고객 ID
- `INTERNAL_SERVER_ERROR` (500): 서버 오류

---

## Database Connection Test

### GET /api/db/test
데이터베이스 연결 테스트

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "connected": true,
    "version": "8.0.35",
    "database": "callup_db",
    "timestamp": "2025-10-23T07:40:00.000Z"
  }
}
```
