# 🚨 백엔드 대시보드 API 긴급 디버깅 요청

## 📋 문서 정보
- **작성일**: 2025-10-29
- **우선순위**: 🔴 긴급
- **상태**: JWT 토큰 정상, 대시보드 500 에러

---

## ✅ 확인 완료 사항

### 1. JWT 토큰 정상 (Frontend)

**로그인 API 응답** (200 OK):
```json
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
      "lastLoginAt": "2025-10-29T07:30:56.276Z"
    },
    "company": {
      "companyId": 2,
      "companyLoginId": "admin",  // ✅ 정상
      "companyName": "(주)CallUp",
      "maxAgents": 999,
      "isActive": 1
    }
  },
  "message": "로그인 성공"
}
```

**JWT 토큰 Payload (디코딩 결과)**:
```json
{
  "userId": 2,
  "companyId": 2,
  "companyLoginId": "admin",  // ✅ 정상적으로 포함됨!
  "userName": "김상담",
  "role": "agent",
  "iat": 1761723056,
  "exp": 1762327856
}
```

**결론**: ✅ **JWT 토큰은 완벽하게 정상입니다!**

---

## ❌ 대시보드 API 500 에러 (Backend)

**요청**:
```
GET https://api.autocallup.com/api/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**응답**:
```json
{
  "success": false,
  "message": "대시보드 조회 중 오류가 발생했습니다.",
  "errorCode": "INTERNAL_SERVER_ERROR"
}
```

**Status**: 500

---

## 🔍 백엔드 디버깅 요청 사항

### 1. 서버 에러 로그 확인 (최우선)

**명령어**:
```bash
# 최근 에러 로그 100줄
tail -100 /home/callup-api/logs/err-0.log

# 또는 PM2 로그
pm2 logs callup-api --lines 100 --err

# 실시간 모니터링
tail -f /home/callup-api/logs/err-0.log
```

**확인할 내용**:
- SQL 에러인가? (Unknown column, syntax error 등)
- JavaScript 에러인가? (Cannot read property, undefined 등)
- 에러 스택 트레이스 전체
- 어느 줄에서 에러 발생했는가?

---

### 2. 대시보드 API 코드 확인

**파일**: `app/api/dashboard/route.ts`

#### 예상 문제 1: JWT 디코딩 실패

```typescript
// JWT 검증 부분 확인
const token = req.headers.authorization?.replace('Bearer ', '');
const user = jwt.verify(token, JWT_SECRET);  // ← 여기서 에러?

console.log('JWT Decoded:', {
  userId: user.userId,
  companyId: user.companyId,
  companyLoginId: user.companyLoginId  // ← 이 값이 있는지 확인!
});
```

**확인 사항**:
- `user.companyLoginId`가 "admin"으로 정상 추출되는가?
- `user.userId`가 2로 정상 추출되는가?

---

#### 예상 문제 2: users 테이블 조회 쿼리

**현재 쿼리 (수정된 쿼리)**:
```sql
SELECT user_name, user_phone, user_status_message, last_login_at
FROM users
WHERE user_id = ? AND company_login_id = ?
```

**매개변수**:
```typescript
[user.userId, user.companyLoginId]
// [2, "admin"]
```

**디버깅 로그 추가**:
```typescript
console.log('=== Users 쿼리 ===');
console.log('Query:', userQuery);
console.log('Params:', [user.userId, user.companyLoginId]);

const [userRows] = await db.execute(userQuery, [user.userId, user.companyLoginId]);

console.log('User Result:', userRows);
console.log('User Count:', userRows.length);
```

**확인 사항**:
- 쿼리가 정상 실행되는가?
- `userRows.length`가 1인가? (사용자 1명 조회)
- `userRows[0]`에 데이터가 있는가?

---

#### 예상 문제 3: statistics 테이블 조회

**현재 쿼리**:
```sql
SELECT total_call_count, total_call_time,
       success_count, failed_count, callback_count
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE()
```

**매개변수**:
```typescript
[user.companyId, user.userId]
// [2, 2]
```

**디버깅 로그 추가**:
```typescript
console.log('=== Statistics 쿼리 ===');
console.log('Query:', statsQuery);
console.log('Params:', [user.companyId, user.userId]);

const [statsRows] = await db.execute(statsQuery, [user.companyId, user.userId]);

console.log('Stats Result:', statsRows);
console.log('Stats Count:', statsRows.length);

// NULL 처리 확인
const stats = statsRows[0] || {
  total_call_count: 0,
  total_call_time: '00:00:00',
  success_count: 0,
  failed_count: 0,
  callback_count: 0
};
```

**확인 사항**:
- 쿼리가 정상 실행되는가?
- 오늘 날짜 데이터가 없으면 빈 배열 반환되는가?
- NULL 처리가 되어 있는가?

---

#### 예상 문제 4: db_lists 테이블 조회

**현재 쿼리**:
```sql
SELECT db_id, db_date, db_title, total_count, unused_count
FROM db_lists
WHERE company_id = ? AND is_active = TRUE
ORDER BY db_date DESC
LIMIT 3
```

**매개변수**:
```typescript
[user.companyId]
// [2]
```

**디버깅 로그 추가**:
```typescript
console.log('=== DB Lists 쿼리 ===');
console.log('Query:', dbListsQuery);
console.log('Params:', [user.companyId]);

const [dbListsRows] = await db.execute(dbListsQuery, [user.companyId]);

console.log('DB Lists Result:', dbListsRows);
console.log('DB Lists Count:', dbListsRows.length);
```

**확인 사항**:
- 쿼리가 정상 실행되는가?
- DB 리스트가 없으면 빈 배열 반환되는가?

---

#### 예상 문제 5: 응답 객체 생성

**현재 코드 (예상)**:
```typescript
return NextResponse.json({
  success: true,
  data: {
    user: {
      userName: userRows[0].user_name,
      userPhone: userRows[0].user_phone,              // ← 필드명 확인!
      userStatusMessage: userRows[0].user_status_message,  // ← 필드명 확인!
      isActive: userRows[0].is_active,
      lastActiveTime: userRows[0].last_login_at
    },
    todayStats: {
      callCount: stats.total_call_count,
      callDuration: stats.total_call_time
    },
    callStats: {
      connectedCount: stats.success_count,
      failedCount: stats.failed_count,
      callbackCount: stats.callback_count
    },
    dbLists: dbListsRows.map(row => ({
      dbId: row.db_id,
      date: row.db_date,
      title: row.db_title,
      totalCount: row.total_count,
      unusedCount: row.unused_count
    }))
  }
});
```

**확인 사항**:
- `userRows[0]`이 존재하는가?
- 필드명이 정확한가? (`userPhone`, `userStatusMessage`)
- `stats` 객체가 null이 아닌가?

---

### 3. 데이터베이스 직접 확인

**MySQL 직접 쿼리**:
```sql
-- 1. users 테이블 확인
SELECT user_id, company_login_id, user_name, user_phone, user_status_message
FROM users
WHERE user_id = 2 AND company_login_id = 'admin';

-- 예상 결과:
-- user_id | company_login_id | user_name | user_phone      | user_status_message
-- 2       | admin            | 김상담    | 010-2345-6789   | 업무 중


-- 2. statistics 테이블 확인 (오늘 데이터)
SELECT *
FROM statistics
WHERE company_id = 2 AND user_id = 2 AND stat_date = CURDATE();

-- 예상 결과: 없을 수도 있음 (NULL 처리 필요)


-- 3. db_lists 테이블 확인
SELECT db_id, db_date, db_title, total_count, unused_count
FROM db_lists
WHERE company_id = 2 AND is_active = TRUE
LIMIT 3;

-- 예상 결과: 0개 이상의 행


-- 4. companies 테이블 확인
SELECT company_id, company_login_id, company_name
FROM companies
WHERE company_login_id = 'admin';

-- 예상 결과:
-- company_id | company_login_id | company_name
-- 2          | admin            | (주)CallUp
```

---

## 🧪 임시 디버깅 코드 (추가 요청)

**파일**: `app/api/dashboard/route.ts`

```typescript
export async function GET(req: NextRequest) {
  try {
    console.log('=== Dashboard API Start ===');

    // 1. JWT 토큰 검증
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('Token:', token?.substring(0, 50) + '...');

    const user = jwt.verify(token, JWT_SECRET);
    console.log('JWT Decoded:', {
      userId: user.userId,
      companyId: user.companyId,
      companyLoginId: user.companyLoginId,
      userName: user.userName,
      role: user.role
    });

    // 2. Users 테이블 조회
    console.log('=== Step 1: Users 조회 ===');
    const userQuery = `
      SELECT user_name, user_phone, user_status_message, last_login_at, is_active
      FROM users
      WHERE user_id = ? AND company_login_id = ?
    `;
    console.log('Query:', userQuery);
    console.log('Params:', [user.userId, user.companyLoginId]);

    const [userRows] = await db.execute(userQuery, [user.userId, user.companyLoginId]);
    console.log('User Result:', userRows);
    console.log('User Count:', userRows.length);

    if (userRows.length === 0) {
      console.error('❌ User not found!');
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.',
        errorCode: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    // 3. Statistics 테이블 조회
    console.log('=== Step 2: Statistics 조회 ===');
    const statsQuery = `
      SELECT total_call_count, total_call_time,
             success_count, failed_count, callback_count
      FROM statistics
      WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE()
    `;
    console.log('Query:', statsQuery);
    console.log('Params:', [user.companyId, user.userId]);

    const [statsRows] = await db.execute(statsQuery, [user.companyId, user.userId]);
    console.log('Stats Result:', statsRows);
    console.log('Stats Count:', statsRows.length);

    const stats = statsRows[0] || {
      total_call_count: 0,
      total_call_time: '00:00:00',
      success_count: 0,
      failed_count: 0,
      callback_count: 0
    };

    // 4. DB Lists 테이블 조회
    console.log('=== Step 3: DB Lists 조회 ===');
    const dbListsQuery = `
      SELECT db_id, db_date, db_title, total_count, unused_count
      FROM db_lists
      WHERE company_id = ? AND is_active = TRUE
      ORDER BY db_date DESC
      LIMIT 3
    `;
    console.log('Query:', dbListsQuery);
    console.log('Params:', [user.companyId]);

    const [dbListsRows] = await db.execute(dbListsQuery, [user.companyId]);
    console.log('DB Lists Result:', dbListsRows);
    console.log('DB Lists Count:', dbListsRows.length);

    // 5. 응답 객체 생성
    console.log('=== Step 4: 응답 생성 ===');
    const response = {
      success: true,
      data: {
        user: {
          userName: userRows[0].user_name,
          userPhone: userRows[0].user_phone,
          userStatusMessage: userRows[0].user_status_message,
          isActive: userRows[0].is_active,
          lastActiveTime: userRows[0].last_login_at
        },
        todayStats: {
          callCount: stats.total_call_count,
          callDuration: stats.total_call_time
        },
        callStats: {
          connectedCount: stats.success_count,
          failedCount: stats.failed_count,
          callbackCount: stats.callback_count
        },
        dbLists: dbListsRows.map(row => ({
          dbId: row.db_id,
          date: row.db_date,
          title: row.db_title,
          totalCount: row.total_count,
          unusedCount: row.unused_count
        }))
      }
    };

    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('=== Dashboard API Success ===');

    return NextResponse.json(response);

  } catch (error) {
    console.error('=== Dashboard API Error ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);

    // 구체적인 에러 정보 반환
    return NextResponse.json({
      success: false,
      message: '대시보드 조회 중 오류가 발생했습니다.',
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorDetail: error.message  // ← 임시로 에러 상세 정보 반환
    }, { status: 500 });
  }
}
```

---

## 🔍 예상 원인 순위

### 1순위 (50% 확률): users 테이블 조회 실패
```
원인: WHERE company_login_id = ? 에서 데이터 못 찾음
가능성:
- users 테이블에 company_login_id 컬럼이 없음
- user_id=2, company_login_id='admin' 조합이 없음
- company_login_id가 NULL임
```

### 2순위 (30% 확률): 응답 객체 생성 시 에러
```
원인: userRows[0]이 undefined
가능성:
- users 조회 결과가 빈 배열
- 필드명 불일치 (user_phone vs phone)
```

### 3순위 (15% 확률): statistics NULL 처리 누락
```
원인: stats가 null인데 .total_call_count 접근
가능성:
- 오늘 날짜 통계 데이터가 없음
- NULL 체크 없이 바로 접근
```

### 4순위 (5% 확률): DB 연결 에러
```
원인: MySQL 연결 실패 또는 타임아웃
가능성:
- DB 서버 다운
- 연결 풀 부족
```

---

## ✅ 긴급 조치 요청

### 즉시 확인 사항 (순서대로)

1. **에러 로그 전체 확인**
   ```bash
   tail -100 /home/callup-api/logs/err-0.log
   ```

2. **users 테이블 직접 조회**
   ```sql
   SELECT * FROM users WHERE user_id = 2 AND company_login_id = 'admin';
   ```

3. **임시 디버깅 로그 추가**
   - 위의 디버깅 코드를 `app/api/dashboard/route.ts`에 추가
   - 앱에서 다시 로그인 시도
   - PM2 로그에서 상세 로그 확인

4. **에러 상세 정보 공유**
   - Error Type
   - Error Message
   - Error Stack
   - 어느 Step에서 실패했는지

---

## 📞 회신 요청 정보

다음 정보를 공유해 주시면 정확한 원인 파악 가능합니다:

1. **에러 로그 전체** (`/home/callup-api/logs/err-0.log`)
2. **users 테이블 조회 결과** (위의 SQL 쿼리)
3. **디버깅 로그 출력 결과** (console.log)
4. **데이터베이스 스키마 확인**:
   ```sql
   DESCRIBE users;
   ```

---

**작성일**: 2025-10-29 16:31 (KST)
**우선순위**: 🔴 최우선 긴급
**상태**: JWT 정상, 백엔드 디버깅 필요
