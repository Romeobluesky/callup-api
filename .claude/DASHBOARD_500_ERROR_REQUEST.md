# 대시보드 API 500 에러 긴급 디버깅 요청

## 문서 정보
- **작성일**: 2025-10-29
- **우선순위**: 🔴 긴급
- **상태**: 로그인 성공, 대시보드 조회 실패

---

## 현재 상황

### ✅ 로그인 성공
```json
POST /api/auth/login
Status: 200

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 2,
      "userName": "김상담",
      "userPhone": "010-2345-6789",
      "userStatusMessage": "업무 중",
      "isActive": 1,
      "lastLoginAt": "2025-10-29T06:22:07.775Z"
    },
    "company": {
      "companyId": 2,
      "companyLoginId": "admin",
      "companyName": "(주)CallUp",
      "maxAgents": 999,
      "isActive": 1
    }
  }
}
```

**JWT 토큰 Payload** (디코딩 결과):
```json
{
  "userId": 2,
  "companyId": 2,
  "companyLoginId": "admin",
  "userName": "김상담",
  "role": "agent",
  "iat": 1761718927,
  "exp": 1762323727
}
```

✅ JWT에 `companyLoginId` 정상 포함됨!

---

### ❌ 대시보드 조회 실패

```
GET /api/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Status: 500
Response:
{
  "success": false,
  "message": "대시보드 조회 중 오류가 발생했습니다.",
  "errorCode": "INTERNAL_SERVER_ERROR"
}
```

---

## 디버깅 요청 사항

### 1. 서버 에러 로그 확인

**명령어**:
```bash
# 최근 에러 로그 확인
tail -100 /home/callup-api/logs/err-0.log

# 또는 PM2 로그
pm2 logs callup-api --lines 100 --err
```

**확인할 내용**:
- SQL 에러인지 (Unknown column, syntax error 등)
- JavaScript 에러인지 (Cannot read property 등)
- 에러 스택 트레이스 전체

---

### 2. 대시보드 쿼리 점검

**예상 문제점**:

#### 문제 1: users 테이블 조회 쿼리
```sql
-- ❌ 잘못된 쿼리 (company_id 사용)
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_id = ?;

-- ✅ 올바른 쿼리 (company_login_id 사용)
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users u
JOIN companies c ON u.company_login_id = c.company_login_id
WHERE u.user_id = ? AND c.company_id = ?;

-- 또는 (JWT에 companyLoginId가 있으므로)
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_login_id = ?;
```

#### 문제 2: 응답 필드명 매핑
```javascript
// ✅ 올바른 응답 (보고서에 명시된 대로)
{
  user: {
    userId: user.user_id,
    userName: user.user_name,
    userPhone: user.user_phone,              // ← phone이 아님!
    userStatusMessage: user.user_status_message,  // ← statusMessage가 아님!
    isActive: user.is_active,
    lastActiveTime: user.last_login_at
  }
}
```

#### 문제 3: statistics 테이블 조회
```sql
-- ✅ statistics는 company_id 그대로 사용 (보고서 확인됨)
SELECT total_call_count, total_call_time
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE();
```

#### 문제 4: db_lists 테이블 조회
```sql
-- ✅ db_lists도 company_id 그대로 사용 (보고서 확인됨)
SELECT db_id, db_date, db_title, total_count, unused_count
FROM db_lists
WHERE company_id = ? AND is_active = TRUE
ORDER BY db_date DESC
LIMIT 3;
```

---

### 3. JWT 토큰 디코딩 확인

**app/api/dashboard/route.ts에서 확인**:

```typescript
// JWT에서 값 추출
const decoded = jwt.verify(token, JWT_SECRET);

console.log('JWT Decoded:', {
  userId: decoded.userId,
  companyId: decoded.companyId,
  companyLoginId: decoded.companyLoginId  // ← 이 값이 있는지 확인!
});
```

**현재 JWT에 포함된 값**:
- ✅ `userId`: 2
- ✅ `companyId`: 2
- ✅ `companyLoginId`: "admin"
- ✅ `userName`: "김상담"
- ✅ `role`: "agent"

---

### 4. 데이터베이스 직접 확인

```sql
-- users 테이블 확인
SELECT user_id, company_login_id, user_name, user_phone, user_status_message
FROM users
WHERE user_id = 2 AND company_login_id = 'admin';

-- companies 테이블 확인
SELECT company_id, company_login_id, company_name
FROM companies
WHERE company_login_id = 'admin';

-- statistics 테이블 확인 (오늘 데이터)
SELECT *
FROM statistics
WHERE company_id = 2 AND user_id = 2 AND stat_date = CURDATE();

-- db_lists 테이블 확인
SELECT db_id, db_date, db_title, total_count, unused_count
FROM db_lists
WHERE company_id = 2 AND is_active = TRUE
LIMIT 3;
```

---

## 예상 원인 순위

### 1순위 (90% 확률): users 테이블 조회 실패
```
원인: WHERE company_id = ? 사용
해결: WHERE company_login_id = ? 로 변경
```

### 2순위 (5% 확률): 응답 필드 매핑 오류
```
원인: phone, statusMessage로 응답
해결: userPhone, userStatusMessage로 응답
```

### 3순위 (3% 확률): statistics 데이터 없음
```
원인: 오늘 날짜 통계 데이터가 없어서 NULL 처리 오류
해결: NULL 체크 추가
```

### 4순위 (2% 확률): db_lists 데이터 없음
```
원인: 활성화된 DB 리스트가 없음
해결: 빈 배열 반환 처리
```

---

## 긴급 조치 요청

### 즉시 확인 사항
1. ✅ `/home/callup-api/logs/err-0.log` 에러 로그 전체 공유
2. ✅ `app/api/dashboard/route.ts` 파일의 users 테이블 조회 쿼리 확인
3. ✅ 응답 객체 생성 부분 확인 (phone vs userPhone)

### 임시 디버깅 코드 추가
```typescript
// app/api/dashboard/route.ts에 추가
try {
  console.log('=== Dashboard API Start ===');
  console.log('JWT:', { userId, companyId, companyLoginId });

  // Step 1: 사용자 정보 조회
  console.log('Step 1: Querying user...');
  const userQuery = `...`;
  console.log('User Query:', userQuery);
  const [userRows] = await db.execute(userQuery, [userId, companyLoginId]);
  console.log('User Result:', userRows);

  // Step 2: 통계 조회
  console.log('Step 2: Querying statistics...');
  // ...

  console.log('=== Dashboard API Success ===');
} catch (error) {
  console.error('=== Dashboard API Error ===');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  throw error;
}
```

---

## 테스트 계정 정보

```
업체 로그인 ID: admin
업체 비밀번호: ujin1436
상담원 이름: 김상담

user_id: 2
company_id: 2
company_login_id: admin
```

---

## 참고 문서

- `DATABASE_MIGRATION_REQUEST.md` - 최초 수정 요청서
- `API_DESIGN_v3.0.0.md` - API 설계 문서 (line 132-175: 대시보드 응답 구조)
- 최종 수정 보고서 (방금 공유한 메시지)

---

## 연락 방법

에러 로그 확인 후 다음 정보를 공유 부탁드립니다:

1. **에러 스택 트레이스** (전체)
2. **실제 실행된 SQL 쿼리**
3. **디버그 로그** (console.log 결과)

긴급 수정 부탁드립니다! 🚨

---

**작성일**: 2025-10-29 14:22 (KST)
