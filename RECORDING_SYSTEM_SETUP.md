# 녹취파일 관리 시스템 구축 완료 보고서

**작성일**: 2025-11-01
**프로젝트**: CallUp 자동 통화 시스템
**작업**: 녹취파일 업로드 및 관리 시스템 구현

---

## ✅ 완료된 작업

### 1. 데이터베이스 마이그레이션

**파일**: `migrations/001_add_audio_columns_to_call_logs.sql`

**추가된 컬럼** (8개):
- `has_audio` BOOLEAN - 녹음 파일 존재 여부
- `audio_file_path` VARCHAR(500) - 파일 저장 경로
- `audio_file_size` BIGINT - 파일 크기 (바이트)
- `audio_duration` INT - 녹음 시간 (초)
- `audio_format` VARCHAR(10) - 파일 형식 (m4a, mp3, amr)
- `original_filename` VARCHAR(255) - 원본 파일명
- `uploaded_at` TIMESTAMP - 업로드 시간
- `upload_status` ENUM - 업로드 상태 (pending, uploading, completed, failed)

**추가된 인덱스** (4개):
- `idx_call_logs_has_audio` - 녹음 파일 존재 여부 검색
- `idx_call_logs_upload_status` - 업로드 상태별 검색
- `idx_call_logs_call_datetime` - 통화 일시 검색
- `idx_call_logs_user_datetime` - 상담원별 통화 일시 검색

**마이그레이션 실행 방법**:
```bash
# MySQL 접속 후 실행
mysql -u root -p callup_db < migrations/001_add_audio_columns_to_call_logs.sql
```

---

### 2. API 엔드포인트 구현 (총 7개)

#### 📱 앱 개발팀용 API (3개)

**1. POST /api/recordings/upload** (자동 업로드)
- 녹취파일 자동 업로드
- 파라미터: `phoneNumber`, `recordedAt`, `duration`
- 전화번호 + 시간 기반 매칭 (±5분 오차 허용)
- call_logs 및 customers 테이블 자동 업데이트
- 파일 검증: 형식(m4a, mp3, amr, 3gp, wav, aac), 크기(최대 50MB)
- 중복 업로드 방지
- 업체별/날짜별 폴더 자동 생성
- 파일명 규칙: `{phone}_{timestamp}_{logId}.{ext}` (통화 기록 있는 경우)
- 파일명 규칙: `{phone}_{timestamp}.{ext}` (통화 기록 없는 경우)

**2. GET /api/recordings/check-exists/{logId}**
- 녹취파일 존재 여부 확인
- 중복 업로드 방지용

**3. GET /api/recordings/{logId}/stream**
- 녹취파일 스트리밍 재생
- Range Request 지원 (부분 재생)
- 캐싱 지원 (24시간)

#### 🖥️ 관리자 페이지용 API (4개)

**4. GET /api/admin/recordings**
- 녹취 목록 조회
- 필터링: 날짜, 상담원, 고객, 녹취 존재 여부
- 페이지네이션 지원

**5. GET /api/recordings/{logId}/download**
- 녹취파일 다운로드
- 원본 파일명 유지

**6. DELETE /api/admin/recordings/{logId}**
- 녹취파일 삭제
- 파일 시스템 및 DB 동시 삭제

**7. GET /api/admin/recordings/stats**
- 녹취 통계 조회
- 총 녹취 수, 총 용량, 총 시간
- 상태별/형식별 통계

---

### 3. 파일 저장 구조

```
/storage/recordings/
├── company_1/                    # 업체별 폴더
│   ├── 2025-01/                  # 년-월 폴더
│   │   ├── 20250115/             # 일자별 폴더
│   │   │   ├── 01012345678_01087654321_20250115143052_101.m4a
│   │   │   ├── 01012345678_01087654321_20250115150230_102.m4a
│   │   │   └── ...
│   │   └── 20250116/
│   │       └── ...
│   └── 2025-02/
│       └── ...
└── company_2/
    └── ...
```

**파일명 규칙**:
- 형식: `{발신번호}_{수신번호}_{날짜시간}_{log_id}.{확장자}`
- 예시: `01012345678_01087654321_20250115143052_101.m4a`
- 날짜시간: YYYYMMDDHHmmss

---

### 4. 보안 및 검증

**파일 검증**:
- MIME 타입 검증: audio/m4a, audio/mp3, audio/amr만 허용
- 파일 크기 제한: 최대 100MB
- 중복 업로드 방지: logId 기준 체크

**인증 및 권한**:
- JWT 토큰 인증 (모든 API)
- 업체별 데이터 격리 (company_id 검증)
- 관리자 권한 검증 (company_admin, super_admin)

**SQL Injection 방지**:
- Prepared Statement 사용
- 파라미터 바인딩

---

### 5. API 문서 업데이트

**파일**: `API_ENDPOINTS.md`

**추가 내용**:
- 목차에 "10. 녹취파일 관리 API" 섹션 추가
- 7개 API 엔드포인트 전체 문서화
- 요청/응답 예시 포함
- 파일 저장 구조 설명
- 주요 변경사항 섹션 업데이트

---

## 📋 팀별 작업 가이드

### 앱 개발팀

**구현 필요 사항**:
1. 통화 종료 후 녹취파일 자동 업로드
2. 업로드 실패 시 재시도 로직
3. 업로드 진행 상태 UI 표시

**API 호출 방법** (자동 업로드):
```typescript
// 통화 종료 후 즉시 업로드
POST /api/recordings/upload
FormData: {
  file: File,              // 녹취 파일
  phoneNumber: string,     // 통화한 전화번호 (발신/수신)
  recordedAt: string,      // 녹음 시각 (ISO 8601 형식)
  duration: number         // 녹음 시간(초)
}

// 예시:
const formData = new FormData()
formData.append('file', audioFile)
formData.append('phoneNumber', '01012345678')
formData.append('recordedAt', '2025-01-15T14:30:52Z')
formData.append('duration', '180')

// API가 자동으로:
// - call_logs에서 통화 기록 검색 (±5분 오차)
// - customers 테이블 업데이트
// - 파일 저장 및 경로 관리
```

**중요 사항**:
- `recordedAt`은 ISO 8601 형식 사용 (예: "2025-01-15T14:30:52Z")
- `phoneNumber`는 발신번호 또는 수신번호 중 하나
- API가 자동으로 통화 기록 매칭 및 테이블 업데이트 처리
- 파일 크기 제한: 50MB (초과 시 413 에러)
- 허용 형식: m4a, mp3, amr, 3gp, wav, aac

---

### 관리자 페이지팀

**구현 필요 사항**:
1. 녹취 목록 조회 및 필터링
2. 녹취파일 재생 (스트리밍)
3. 녹취파일 다운로드
4. 통계 대시보드

**API 호출 예시**:
```typescript
// 1. 녹취 목록 조회
GET /api/admin/recordings?dateFrom=2025-01-01&dateTo=2025-01-31&page=1&limit=20

// 2. 녹취파일 스트리밍
GET /api/recordings/{logId}/stream

// 3. 녹취파일 다운로드
GET /api/recordings/{logId}/download

// 4. 녹취파일 삭제
DELETE /api/admin/recordings/{logId}

// 5. 통계 조회
GET /api/admin/recordings/stats?dateFrom=2025-01-01&dateTo=2025-01-31
```

---

### API 팀 (완료)

**완료 항목**:
- ✅ DB 스키마 확장 (마이그레이션 파일 생성)
- ✅ 7개 API 엔드포인트 구현
- ✅ 파일 저장 및 관리 로직
- ✅ 보안 및 성능 최적화
- ✅ API 문서 업데이트
- ✅ 빌드 및 테스트 완료

---

## 🚀 배포 전 체크리스트

### 데이터베이스

- [ ] 마이그레이션 파일 실행
  ```bash
  mysql -u root -p callup_db < migrations/001_add_audio_columns_to_call_logs.sql
  ```

### 파일 시스템

- [ ] 녹취파일 저장 디렉토리 생성
  ```bash
  mkdir -p storage/recordings
  chmod 755 storage/recordings
  ```

- [ ] 디스크 용량 확인
  - 권장: 최소 100GB 이상

### 환경 설정

- [ ] `.env` 파일 확인
  - DB 연결 정보
  - JWT 시크릿 키

### 서버 배포

- [ ] Next.js 빌드
  ```bash
  npm run build
  ```

- [ ] PM2 재시작 (또는 서버 재시작)
  ```bash
  pm2 restart callup-api
  ```

---

## 📊 성능 최적화

**인덱스 추가**:
- `has_audio` 컬럼 인덱스: 녹취 파일 필터링 속도 향상
- `call_datetime` 인덱스: 날짜별 검색 속도 향상
- `user_id, call_datetime` 복합 인덱스: 상담원별 검색 속도 향상

**캐싱**:
- 스트리밍 API: 24시간 캐싱 (Cache-Control: max-age=86400)

**파일 시스템**:
- 업체별/날짜별 폴더 구조로 파일 관리 효율화

---

## 🔧 향후 개선 사항 (선택)

1. **자동 정리**: 90일 이상 된 녹취파일 자동 아카이브/삭제
2. **CDN 연동**: 자주 조회되는 녹취파일 CDN 캐싱
3. **백업**: 일일 백업 및 외부 스토리지 동기화
4. **모니터링**: 디스크 용량 모니터링 및 알림
5. **재시도 메커니즘**: 업로드 실패 시 자동 재시도

---

## 📞 문의

- **백엔드 개발팀**: API 관련 문의
- **데이터베이스팀**: 마이그레이션 관련 문의
- **인프라팀**: 서버 및 스토리지 관련 문의

---

**작성자**: API 개발팀
**버전**: 1.0.0
**최종 업데이트**: 2025-11-01
