# 🚨 API 팀 긴급 요청 - 대시보드 500 에러

## 현재 상황
- ✅ 로그인: 정상 작동
- ❌ 대시보드: 500 에러 발생

## 서버 로그 확인 요청

백엔드 서버에서 다음 명령어를 실행하고 결과를 공유해주세요:

```bash
# 최근 에러 로그 확인
tail -50 /home/callup-api/logs/err-0.log

# 또는
pm2 logs callup-api --err --lines 50
```

## 예상 원인

`app/api/dashboard/route.ts`에서 users 테이블 조회 시 **여전히 `company_id`를 사용**하고 있을 가능성:

```typescript
// ❌ 잘못된 코드 (추정)
const [userRows] = await db.execute(
  'SELECT user_name, user_phone, user_status_message, last_login_at FROM users WHERE user_id = ? AND company_id = ?',
  [userId, companyId]
);
```

**수정 필요**:
```typescript
// ✅ 올바른 코드
const [userRows] = await db.execute(
  'SELECT user_name, user_phone, user_status_message, last_login_at FROM users WHERE user_id = ? AND company_login_id = ?',
  [userId, companyLoginId]  // JWT에서 companyLoginId 사용
);
```

## 테스트 계정

```
업체 로그인 ID: admin
비밀번호: ujin1436
상담원 이름: 김상담

JWT 토큰에 포함된 값:
- userId: 2
- companyId: 2
- companyLoginId: "admin"
```

## 요청 사항

1. 서버 에러 로그 전체 공유
2. `app/api/dashboard/route.ts` 파일의 users 테이블 쿼리 확인
3. 수정 후 재배포

긴급 처리 부탁드립니다! 🙏
