# 🚨 statistics 테이블 company_id 컬럼 없음 긴급 수정 요청

## 📋 문서 정보
- **작성일**: 2025-10-29 16:50
- **우선순위**: 🔴 최우선 긴급
- **상태**: 에러 원인 확정

---

## ❌ 에러 내용

### PM2 로그 (err-0.log)

```
Error: Unknown column 'company_id' in 'where clause'

SQL:
SELECT
  COALESCE(total_call_count, 0) as call_count,
  COALESCE(total_call_time, '00:00:00') as call_duration
FROM statistics
WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE()

Error Code: ER_BAD_FIELD_ERROR
Error Number: 1054
SQL State: 42S22
```

### 에러 발생 위치

**파일**: `app/api/dashboard/route.ts`
**Step**: Step 2 - Statistics 조회

```
=== Step 2: Statistics 조회 ===
Query params: [ 2, 2 ]
❌ Error: Unknown column 'company_id' in 'where clause'
```

---

## 🔍 문제 분석

### 기대했던 것

API팀 답변:
> statistics 테이블은 원래 company_id를 사용하는 테이블이므로 문제없음

### 실제 상황

**statistics 테이블에 `company_id` 컬럼이 없음!**

가능한 시나리오:
1. **시나리오 A**: DB 마이그레이션 시 `company_id` 컬럼이 삭제됨
2. **시나리오 B**: `company_id`가 `company_login_id`로 변경됨
3. **시나리오 C**: statistics 테이블 자체가 변경됨

---

## 🔧 즉시 확인 필요 사항

### 1. statistics 테이블 스키마 확인 (최우선)

```sql
DESCRIBE statistics;
```

**예상 결과 1** (company_id가 company_login_id로 변경):
```
+-----------------+--------------+------+-----+---------+
| Field           | Type         | Null | Key | Default |
+-----------------+--------------+------+-----+---------+
| stat_id         | int          | NO   | PRI | NULL    |
| company_login_id| varchar(50)  | NO   | MUL | NULL    |  ← 변경됨!
| user_id         | int          | NO   | MUL | NULL    |
| stat_date       | date         | NO   |     | NULL    |
| total_call_count| int          | YES  |     | 0       |
| total_call_time | time         | YES  |     | NULL    |
| ...             | ...          | ...  | ... | ...     |
+-----------------+--------------+------+-----+---------+
```

**예상 결과 2** (company_id 삭제됨):
```
+-----------------+--------------+------+-----+---------+
| Field           | Type         | Null | Key | Default |
+-----------------+--------------+------+-----+---------+
| stat_id         | int          | NO   | PRI | NULL    |
| user_id         | int          | NO   | MUL | NULL    |  ← company_id 없음!
| stat_date       | date         | NO   |     | NULL    |
| ...             | ...          | ...  | ... | ...     |
+-----------------+--------------+------+-----+---------+
```

---

### 2. 현재 statistics 데이터 확인

```sql
-- 테이블 구조 확인
SHOW CREATE TABLE statistics;

-- 데이터 샘플 확인
SELECT * FROM statistics LIMIT 5;

-- 인덱스 확인
SHOW INDEX FROM statistics;
```

---

## 🔧 수정 방안 (시나리오별)

### 시나리오 A: company_login_id로 변경된 경우

**대시보드 API 수정** (`app/api/dashboard/route.ts`):

```typescript
// ❌ 현재 코드
const statsQuery = `
  SELECT
    COALESCE(total_call_count, 0) as call_count,
    COALESCE(total_call_time, '00:00:00') as call_duration
  FROM statistics
  WHERE company_id = ? AND user_id = ? AND stat_date = CURDATE()
`;
const [statsRows] = await db.execute(statsQuery, [user.companyId, user.userId]);

// ✅ 수정된 코드
const statsQuery = `
  SELECT
    COALESCE(total_call_count, 0) as call_count,
    COALESCE(total_call_time, '00:00:00') as call_duration
  FROM statistics
  WHERE company_login_id = ? AND user_id = ? AND stat_date = CURDATE()
`;
const [statsRows] = await db.execute(statsQuery, [user.companyLoginId, user.userId]);
```

**Call Results 쿼리도 동일하게 수정** (Step 3):

```typescript
// ❌ 현재
const callResultsQuery = `
  SELECT call_result, COUNT(*) as count
  FROM call_logs
  WHERE company_id = ? AND user_id = ? AND DATE(call_datetime) = CURDATE()
  GROUP BY call_result
`;
await db.execute(callResultsQuery, [user.companyId, user.userId]);

// ✅ 수정
const callResultsQuery = `
  SELECT call_result, COUNT(*) as count
  FROM call_logs
  WHERE company_login_id = ? AND user_id = ? AND DATE(call_datetime) = CURDATE()
  GROUP BY call_result
`;
await db.execute(callResultsQuery, [user.companyLoginId, user.userId]);
```

---

### 시나리오 B: company_id 컬럼이 완전히 삭제된 경우

**statistics 테이블에 업체 구분자가 없다면**:

```typescript
// ✅ company_id 없이 user_id만으로 조회
const statsQuery = `
  SELECT
    COALESCE(total_call_count, 0) as call_count,
    COALESCE(total_call_time, '00:00:00') as call_duration
  FROM statistics
  WHERE user_id = ? AND stat_date = CURDATE()
`;
const [statsRows] = await db.execute(statsQuery, [user.userId]);
```

**하지만 이 경우 문제점**:
- 여러 업체에서 같은 user_id를 사용하면 충돌 가능
- 업체별 통계 분리 불가

**권장 해결책**: `company_login_id` 컬럼 추가

```sql
-- statistics 테이블에 company_login_id 추가
ALTER TABLE statistics
ADD COLUMN company_login_id VARCHAR(50) NOT NULL AFTER stat_id,
ADD INDEX idx_company_login_id (company_login_id);

-- 외래키 설정
ALTER TABLE statistics
ADD CONSTRAINT fk_statistics_company
FOREIGN KEY (company_login_id) REFERENCES companies(company_login_id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 기존 데이터 업데이트 (users 테이블과 조인하여)
UPDATE statistics s
JOIN users u ON s.user_id = u.user_id
SET s.company_login_id = u.company_login_id;
```

---

### 시나리오 C: users 테이블과 조인 필요

**statistics에 업체 정보가 없다면 users와 조인**:

```typescript
const statsQuery = `
  SELECT
    COALESCE(s.total_call_count, 0) as call_count,
    COALESCE(s.total_call_time, '00:00:00') as call_duration
  FROM statistics s
  JOIN users u ON s.user_id = u.user_id
  WHERE u.company_login_id = ? AND s.user_id = ? AND s.stat_date = CURDATE()
`;
const [statsRows] = await db.execute(statsQuery, [user.companyLoginId, user.userId]);
```

**단점**: 성능 저하 (매번 조인 필요)

---

## 🔍 동일한 문제가 있을 다른 API

### 확인 필요한 API들

1. **`/api/statistics`** - 통계 조회 API
   ```typescript
   WHERE company_id = ? AND user_id = ?
   // → company_login_id로 변경 필요
   ```

2. **`/api/company-admin/statistics`** - 업체 관리자 통계
   ```typescript
   WHERE company_id = ?
   // → company_login_id로 변경 필요
   ```

3. **`/api/dashboard/route.ts` - Call Results (Step 3)**
   ```typescript
   // call_logs 테이블도 확인 필요
   WHERE company_id = ? AND user_id = ?
   ```

4. **`/api/db-lists`** - DB 리스트 조회
   ```typescript
   WHERE company_id = ?
   // → 이것도 company_login_id로 변경 필요한지 확인
   ```

---

## 📋 긴급 조치 체크리스트

### 즉시 확인 (서버)

- [ ] **statistics 테이블 스키마 확인**
  ```sql
  DESCRIBE statistics;
  ```

- [ ] **call_logs 테이블 스키마 확인**
  ```sql
  DESCRIBE call_logs;
  ```

- [ ] **db_lists 테이블 스키마 확인**
  ```sql
  DESCRIBE db_lists;
  ```

- [ ] **db_assignments 테이블 스키마 확인**
  ```sql
  DESCRIBE db_assignments;
  ```

### 백엔드 수정 (스키마 확인 후)

**시나리오 A (company_login_id로 변경)인 경우**:
- [ ] `app/api/dashboard/route.ts` - statistics 쿼리 수정
- [ ] `app/api/dashboard/route.ts` - call_logs 쿼리 수정
- [ ] `app/api/statistics/route.ts` - 전체 수정
- [ ] `app/api/company-admin/statistics/route.ts` - 전체 수정
- [ ] `app/api/db-lists/route.ts` - 확인 및 수정
- [ ] 기타 statistics, call_logs 사용하는 모든 API 수정

**시나리오 B (company_id 삭제)인 경우**:
- [ ] DB 마이그레이션: `company_login_id` 컬럼 추가
- [ ] 기존 데이터 업데이트
- [ ] 백엔드 API 수정 (시나리오 A와 동일)

---

## 🧪 테스트 SQL 쿼리

### 1. 현재 statistics 데이터 확인

```sql
-- 데이터가 있는지 확인
SELECT COUNT(*) as total_records FROM statistics;

-- 최근 데이터 확인
SELECT * FROM statistics
ORDER BY stat_date DESC
LIMIT 5;

-- user_id=2 데이터 확인
SELECT * FROM statistics
WHERE user_id = 2
ORDER BY stat_date DESC
LIMIT 5;
```

### 2. users와 조인 테스트

```sql
-- users와 조인하여 company 정보 확인
SELECT
  s.stat_id,
  s.user_id,
  u.company_login_id,
  u.user_name,
  s.stat_date,
  s.total_call_count,
  s.total_call_time
FROM statistics s
JOIN users u ON s.user_id = u.user_id
WHERE u.company_login_id = 'admin' AND s.user_id = 2
ORDER BY s.stat_date DESC
LIMIT 5;
```

### 3. 컬럼 추가 후 테스트 (시나리오 B인 경우)

```sql
-- company_login_id 컬럼 추가 후
SELECT company_login_id, user_id, stat_date, total_call_count
FROM statistics
WHERE company_login_id = 'admin' AND user_id = 2 AND stat_date = CURDATE();
```

---

## 📊 예상 수정 범위

### 영향 받는 테이블

| 테이블 | 현재 상태 | 필요한 조치 |
|--------|----------|------------|
| **users** | ✅ company_login_id 사용 | 수정 완료 |
| **companies** | ✅ PK: company_id, UK: company_login_id | 정상 |
| **statistics** | ❌ company_id 없음! | 🔴 확인 필요 |
| **call_logs** | ❓ 미확인 | 🔴 확인 필요 |
| **db_lists** | ❓ 미확인 | 🔴 확인 필요 |
| **db_assignments** | ❓ 미확인 | 🔴 확인 필요 |
| **customers** | ✅ db_id 간접참조 | 정상 |

### 영향 받는 API 파일 (예상)

1. ✅ `app/api/dashboard/route.ts` (Step 2, 3 수정 필요)
2. ❓ `app/api/statistics/route.ts`
3. ❓ `app/api/company-admin/statistics/route.ts`
4. ❓ `app/api/db-lists/route.ts`
5. ❓ `app/api/auto-call/route.ts` (call_logs 사용 시)
6. ❓ `app/api/call-results/route.ts` (call_logs 사용 시)

---

## 🎯 권장 조치 순서

### 1단계: 즉시 확인 (5분)

```sql
-- MySQL 접속
mysql -u root -p callup

-- 테이블 스키마 모두 확인
DESCRIBE statistics;
DESCRIBE call_logs;
DESCRIBE db_lists;
DESCRIBE db_assignments;
```

### 2단계: 스키마 결과 공유 (즉시)

확인 결과를 바로 공유해주세요:
- statistics 테이블에 어떤 컬럼들이 있는가?
- company_id가 있는가? company_login_id가 있는가? 둘 다 없는가?

### 3단계: 수정 방향 결정 (5분)

스키마 확인 후 위의 시나리오 A, B, C 중 선택

### 4단계: 백엔드 수정 (10-20분)

선택된 시나리오에 따라 수정

### 5단계: PM2 재시작 및 테스트 (5분)

```bash
pm2 restart callup-api
pm2 logs callup-api --lines 0
```

Flutter 앱에서 재로그인 → 대시보드 확인

---

## 📞 회신 요청

**즉시 확인 후 다음 정보를 공유해주세요**:

1. **statistics 테이블 스키마** (`DESCRIBE statistics;`)
2. **call_logs 테이블 스키마** (`DESCRIBE call_logs;`)
3. **db_lists 테이블 스키마** (`DESCRIBE db_lists;`)
4. **db_assignments 테이블 스키마** (`DESCRIBE db_assignments;`)

이 정보만 있으면 정확한 수정 방법을 즉시 제공할 수 있습니다!

---

**작성일**: 2025-10-29 16:50 (KST)
**우선순위**: 🔴 최우선 긴급
**예상 소요 시간**: 스키마 확인 후 15-30분
