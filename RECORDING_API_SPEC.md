# 녹취 파일 자동 업로드 시스템 API 명세서

## 개요

CallUp 모바일 앱에서 자동으로 수집한 녹취 파일을 서버에 업로드하고 관리하기 위한 API 명세서입니다.

## 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│ CallUp 모바일 앱 (Android)                                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ RecordingAutoCollector                                │   │
│  │ - 제조사별 녹음 경로 스캔 (삼성, 샤오미, LG 등)        │   │
│  │ - 파일명에서 전화번호 추출                            │   │
│  │ - 지원 포맷: mp3, m4a, amr, 3gp, wav, aac            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CallRecordingMatcher                                  │   │
│  │ - Android CallLog와 녹취 파일 매칭                    │   │
│  │ - 5분 시간 오차 허용                                  │   │
│  │ - 전화번호 부분 매칭                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ RecordingUploadService (Foreground Service)           │   │
│  │ - 10분 간격 자동 업로드                               │   │
│  │ - 중복 업로드 방지 (SharedPreferences)               │   │
│  │ - JWT 토큰 자동 헤더 추가                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTPS
                  (Multipart/form-data)
┌─────────────────────────────────────────────────────────────┐
│ 백엔드 서버 (Node.js/Express 또는 기타)                      │
│                                                               │
│  POST /api/recordings/upload                                 │
│  - 파일 수신 및 저장                                          │
│  - DB에 메타데이터 저장                                       │
│  - 고객 정보와 연결                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 데이터베이스 (MySQL)                                          │
│                                                               │
│  customers 테이블                                             │
│  - hasAudio (TINYINT) - 녹취 파일 존재 여부                  │
│  - audioFilePath (VARCHAR) - 서버 저장 경로                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 녹취 파일 업로드 API

### 엔드포인트

```
POST /api/recordings/upload
```

### 인증

JWT Bearer Token 방식

```http
Authorization: Bearer {JWT_TOKEN}
```

**JWT 토큰 위치**: 앱에서 `SharedPreferences`의 `flutter.auth_token` 키에 저장됨

### 요청 형식

**Content-Type**: `multipart/form-data`

#### 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| file | File | ✅ | 녹취 오디오 파일 | recording.mp3 |
| phoneNumber | String | ✅ | 고객 전화번호 | 01012345678 |
| recordedAt | Long | ✅ | 녹취 시간 (Unix timestamp, milliseconds) | 1730361600000 |
| duration | Integer | ✅ | 통화 시간 (초 단위) | 125 |

#### 요청 예시 (cURL)

```bash
curl -X POST https://api.autocallup.com/api/recordings/upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "file=@/path/to/recording.mp3" \
  -F "phoneNumber=01012345678" \
  -F "recordedAt=1730361600000" \
  -F "duration=125"
```

#### 요청 예시 (Node.js + Express + Multer)

```javascript
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/api/recordings/upload',
  authenticateJWT,  // JWT 인증 미들웨어
  upload.single('file'),
  async (req, res) => {
    const { phoneNumber, recordedAt, duration } = req.body;
    const file = req.file;

    // 파일 처리 및 DB 저장
    // ...
  }
);
```

### 응답 형식

#### 성공 응답 (200 OK)

```json
{
  "success": true,
  "message": "녹취 파일이 업로드되었습니다",
  "data": {
    "audioId": 123,
    "fileName": "recording_01012345678_1730361600000.mp3",
    "filePath": "/uploads/recordings/2025/01/recording_01012345678_1730361600000.mp3",
    "fileSize": 1048576,
    "phoneNumber": "01012345678",
    "recordedAt": "2025-01-24T14:30:00.000Z",
    "duration": 125,
    "uploadedAt": "2025-01-24T15:00:00.000Z"
  }
}
```

#### 실패 응답

**400 Bad Request** - 필수 파라미터 누락
```json
{
  "success": false,
  "message": "필수 파라미터가 누락되었습니다",
  "error": "phoneNumber is required"
}
```

**401 Unauthorized** - JWT 토큰 없음 또는 만료
```json
{
  "success": false,
  "message": "인증에 실패했습니다",
  "error": "Token expired"
}
```

**413 Payload Too Large** - 파일 크기 초과
```json
{
  "success": false,
  "message": "파일 크기가 너무 큽니다",
  "error": "Max file size is 50MB"
}
```

**500 Internal Server Error** - 서버 오류
```json
{
  "success": false,
  "message": "서버 오류가 발생했습니다",
  "error": "Database connection failed"
}
```

---

## 2. 데이터베이스 스키마

### customers 테이블 수정 사항

기존 `customers` 테이블에 다음 컬럼 추가:

```sql
ALTER TABLE customers
ADD COLUMN has_audio TINYINT(1) DEFAULT 0 COMMENT '녹취 파일 존재 여부 (0: 없음, 1: 있음)',
ADD COLUMN audio_file_path VARCHAR(500) DEFAULT NULL COMMENT '서버 저장 경로';

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX idx_has_audio ON customers(has_audio);
CREATE INDEX idx_phone_audio ON customers(customer_phone, has_audio);
```

### recordings 테이블 생성 (선택사항)

녹취 파일 메타데이터를 별도 테이블로 관리할 경우:

```sql
CREATE TABLE recordings (
  recording_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  db_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL COMMENT '업로드한 상담원 ID',

  -- 파일 정보
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL COMMENT '파일 크기 (bytes)',
  file_format VARCHAR(10) NOT NULL COMMENT 'mp3, m4a, amr 등',

  -- 통화 정보
  phone_number VARCHAR(20) NOT NULL,
  recorded_at DATETIME NOT NULL COMMENT '녹취 시간',
  call_duration INT NOT NULL COMMENT '통화 시간 (초)',

  -- 메타데이터
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_processed TINYINT(1) DEFAULT 0 COMMENT '처리 완료 여부',

  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  FOREIGN KEY (db_id) REFERENCES db_lists(db_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),

  INDEX idx_customer (customer_id),
  INDEX idx_phone (phone_number),
  INDEX idx_recorded_at (recorded_at),
  INDEX idx_uploaded_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. 파일 저장 전략

### 권장 디렉토리 구조

```
/uploads/recordings/
├── 2025/
│   ├── 01/
│   │   ├── recording_01012345678_1730361600000.mp3
│   │   ├── recording_01087654321_1730365200000.m4a
│   │   └── ...
│   ├── 02/
│   │   └── ...
│   └── ...
└── 2026/
    └── ...
```

### 파일명 규칙

```
recording_{phoneNumber}_{timestamp}.{extension}
```

예시: `recording_01012345678_1730361600000.mp3`

### 파일 크기 제한

- **권장 최대 크기**: 50MB
- **이유**: 10분 통화 기준 고품질 MP3가 약 10-15MB

### 저장 위치 권장사항

1. **로컬 디스크**: 빠른 접근, 백업 필요
2. **클라우드 스토리지**: AWS S3, Google Cloud Storage 등
3. **하이브리드**: 최근 파일은 로컬, 오래된 파일은 클라우드

---

## 4. 업로드 로직

### 앱 측 업로드 프로세스

```
1. RecordingAutoCollector가 녹취 파일 스캔
   ↓
2. CallRecordingMatcher가 통화 기록과 매칭
   ↓
3. SharedPreferences에서 업로드 여부 확인
   - 이미 업로드됨 → SKIP
   - 미업로드 → 4번으로
   ↓
4. JWT 토큰 가져오기 (SharedPreferences)
   ↓
5. OkHttp로 Multipart 업로드
   ↓
6. 성공 시 SharedPreferences에 업로드 완료 기록
   - Key: 파일 경로
   - Value: 업로드 시간 (timestamp)
```

### 서버 측 처리 권장사항

```javascript
// 1. JWT 토큰 검증
const user = verifyJWT(req.headers.authorization);

// 2. 파일 검증
if (!req.file) {
  return res.status(400).json({ success: false, message: '파일이 없습니다' });
}

// 3. 파일 크기 검증
const maxSize = 50 * 1024 * 1024; // 50MB
if (req.file.size > maxSize) {
  return res.status(413).json({ success: false, message: '파일 크기 초과' });
}

// 4. 파일 형식 검증
const allowedFormats = ['mp3', 'm4a', 'amr', '3gp', 'wav', 'aac'];
const ext = path.extname(req.file.originalname).toLowerCase().substring(1);
if (!allowedFormats.includes(ext)) {
  return res.status(400).json({ success: false, message: '지원하지 않는 파일 형식' });
}

// 5. 고객 정보 조회
const customer = await db.query(
  'SELECT * FROM customers WHERE customer_phone = ?',
  [phoneNumber]
);

if (!customer) {
  return res.status(404).json({ success: false, message: '고객을 찾을 수 없습니다' });
}

// 6. 파일 저장 (년/월 디렉토리)
const date = new Date(parseInt(recordedAt));
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const fileName = `recording_${phoneNumber}_${recordedAt}.${ext}`;
const dirPath = path.join('uploads', 'recordings', String(year), month);
const filePath = path.join(dirPath, fileName);

await fs.promises.mkdir(dirPath, { recursive: true });
await fs.promises.rename(req.file.path, filePath);

// 7. DB에 메타데이터 저장
await db.query(
  `INSERT INTO recordings
   (customer_id, db_id, user_id, file_name, file_path, file_size,
    file_format, phone_number, recorded_at, call_duration)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    customer.customer_id,
    customer.db_id,
    user.user_id,
    fileName,
    filePath,
    req.file.size,
    ext,
    phoneNumber,
    new Date(parseInt(recordedAt)),
    duration
  ]
);

// 8. customers 테이블 업데이트
await db.query(
  'UPDATE customers SET has_audio = 1, audio_file_path = ? WHERE customer_id = ?',
  [filePath, customer.customer_id]
);

// 9. 성공 응답
return res.status(200).json({
  success: true,
  message: '녹취 파일이 업로드되었습니다',
  data: { ... }
});
```

---

## 5. 중복 업로드 방지

### 앱 측 (이미 구현됨)

앱에서 `SharedPreferences`를 사용하여 업로드된 파일을 추적:

```kotlin
// 업로드 완료 시
val prefs = getSharedPreferences("recording_uploads", MODE_PRIVATE)
prefs.edit().putLong(filePath, System.currentTimeMillis()).apply()

// 업로드 전 확인
val isUploaded = prefs.contains(filePath)
if (isUploaded) {
  // 이미 업로드됨 → SKIP
}
```

### 서버 측 (권장)

추가로 서버에서도 중복 검증:

```javascript
// 파일 해시 계산 (MD5 또는 SHA256)
const crypto = require('crypto');
const fileHash = crypto
  .createHash('md5')
  .update(fs.readFileSync(req.file.path))
  .digest('hex');

// DB에서 중복 확인
const existing = await db.query(
  'SELECT * FROM recordings WHERE phone_number = ? AND recorded_at = ?',
  [phoneNumber, new Date(parseInt(recordedAt))]
);

if (existing) {
  return res.status(409).json({
    success: false,
    message: '이미 업로드된 파일입니다'
  });
}
```

---

## 6. 보안 고려사항

### 1. JWT 토큰 검증

```javascript
const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '토큰이 없습니다' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다' });
  }
}
```

### 2. 파일 업로드 보안

- **파일 크기 제한**: 50MB
- **파일 형식 제한**: mp3, m4a, amr, 3gp, wav, aac만 허용
- **파일 내용 검증**: Magic Number 확인
- **바이러스 스캔**: ClamAV 등 활용

```javascript
// Magic Number 검증 (MP3 파일 예시)
const fileBuffer = fs.readFileSync(req.file.path);
const magicNumber = fileBuffer.toString('hex', 0, 3);

if (magicNumber !== '494433' && magicNumber !== 'fffb') {
  // ID3 태그 또는 MPEG 프레임 시작이 아님
  return res.status(400).json({ success: false, message: '유효하지 않은 MP3 파일' });
}
```

### 3. 접근 제어

- **업로드**: 해당 업체 소속 상담원만 가능
- **다운로드**: 해당 업체 소속 상담원 + 관리자만 가능

```javascript
// 업체 소속 확인
if (user.companyId !== customer.companyId) {
  return res.status(403).json({
    success: false,
    message: '해당 고객의 녹취를 업로드할 권한이 없습니다'
  });
}
```

---

## 7. 관리자 페이지 연동

### 고객 검색 화면에서 오디오 아이콘 표시

앱에서 이미 구현됨:

```dart
// lib/screens/customer_search_screen.dart
if (hasAudio)
  GestureDetector(
    onTap: () async {
      await RecordingService.playRecording(customerPhone);
    },
    child: Icon(Icons.volume_up, color: Color(0xFFFFCDDD)),
  ),
```

### 관리자 페이지 권장 기능

#### 1. 녹취 파일 목록 조회 API

```
GET /api/recordings?customerId={customerId}
```

**응답 예시**:
```json
{
  "success": true,
  "data": [
    {
      "recordingId": 123,
      "fileName": "recording_01012345678_1730361600000.mp3",
      "fileSize": 1048576,
      "duration": 125,
      "recordedAt": "2025-01-24T14:30:00.000Z",
      "uploadedAt": "2025-01-24T15:00:00.000Z",
      "uploadedBy": "김상담"
    }
  ]
}
```

#### 2. 녹취 파일 다운로드 API

```
GET /api/recordings/{recordingId}/download
```

**응답**: 파일 스트림 (Content-Type: audio/mpeg)

```javascript
app.get('/api/recordings/:recordingId/download', authenticateJWT, async (req, res) => {
  const recording = await db.query(
    'SELECT * FROM recordings WHERE recording_id = ?',
    [req.params.recordingId]
  );

  if (!recording) {
    return res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다' });
  }

  // 권한 확인 (생략)

  res.download(recording.file_path, recording.file_name);
});
```

#### 3. 녹취 파일 스트리밍 API

```
GET /api/recordings/{recordingId}/stream
```

웹 플레이어에서 재생할 수 있도록 스트리밍:

```javascript
app.get('/api/recordings/:recordingId/stream', authenticateJWT, async (req, res) => {
  const recording = await db.query(
    'SELECT * FROM recordings WHERE recording_id = ?',
    [req.params.recordingId]
  );

  if (!recording) {
    return res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다' });
  }

  const stat = fs.statSync(recording.file_path);
  const range = req.headers.range;

  if (range) {
    // Range 요청 처리 (seekable 스트리밍)
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(recording.file_path, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'audio/mpeg',
    });

    fs.createReadStream(recording.file_path).pipe(res);
  }
});
```

---

## 8. 모니터링 및 로깅

### 권장 로그 항목

```javascript
// 업로드 성공 시
logger.info({
  action: 'RECORDING_UPLOAD_SUCCESS',
  userId: user.user_id,
  customerId: customer.customer_id,
  fileName: fileName,
  fileSize: req.file.size,
  duration: duration,
  timestamp: new Date()
});

// 업로드 실패 시
logger.error({
  action: 'RECORDING_UPLOAD_FAILED',
  userId: user.user_id,
  phoneNumber: phoneNumber,
  error: err.message,
  timestamp: new Date()
});
```

### 모니터링 지표

- **업로드 성공률**: (성공 건수 / 전체 시도 건수) × 100
- **평균 파일 크기**: 저장 용량 예측
- **평균 업로드 시간**: 네트워크 성능 모니터링
- **일일 업로드 건수**: 트래픽 패턴 파악

---

## 9. 테스트 가이드

### 단위 테스트

```javascript
describe('POST /api/recordings/upload', () => {
  it('정상적으로 파일을 업로드해야 함', async () => {
    const res = await request(app)
      .post('/api/recordings/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('file', 'test/fixtures/test_recording.mp3')
      .field('phoneNumber', '01012345678')
      .field('recordedAt', '1730361600000')
      .field('duration', '125');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('JWT 토큰이 없으면 401 반환', async () => {
    const res = await request(app)
      .post('/api/recordings/upload')
      .attach('file', 'test/fixtures/test_recording.mp3');

    expect(res.status).toBe(401);
  });

  it('파일이 없으면 400 반환', async () => {
    const res = await request(app)
      .post('/api/recordings/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .field('phoneNumber', '01012345678');

    expect(res.status).toBe(400);
  });
});
```

### 통합 테스트

1. **앱에서 실제 녹취 파일 업로드**
2. **DB 확인**: customers 테이블의 has_audio = 1
3. **파일 시스템 확인**: 파일이 올바른 경로에 저장됨
4. **관리자 페이지 확인**: 오디오 아이콘 표시, 재생 가능

---

## 10. FAQ

### Q1. 같은 전화번호로 여러 번 통화한 경우?

**A**: `recordedAt` (녹취 시간)으로 구분됩니다. 각각 별도의 녹취 파일로 업로드됩니다.

### Q2. 앱이 강제 종료되면 업로드가 중단되나요?

**A**: 아니요. `RecordingUploadService`는 Foreground Service로 실행되어 시스템에 의한 종료를 최소화합니다. 또한 앱 재시작 시 자동으로 재시작됩니다.

### Q3. 네트워크 오류로 업로드 실패 시 재시도하나요?

**A**: 네. 10분 간격으로 재시도합니다. 업로드 성공 시에만 SharedPreferences에 기록되므로 실패한 파일은 다음 주기에 다시 시도됩니다.

### Q4. 오래된 녹취 파일도 모두 업로드하나요?

**A**: 아니요. `scanTodaysRecordings()` 메서드는 최근 24시간 이내의 녹취 파일만 스캔합니다.

### Q5. 파일 저장 용량은 얼마나 필요한가요?

**A**:
- 1시간 통화 = 약 60MB (고품질 MP3 기준)
- 상담원 1명당 하루 평균 2시간 통화 = 120MB
- 상담원 10명 × 30일 = 약 36GB/월

---

## 11. 연락처

기술 지원 및 문의:
- **백엔드 팀**: backend-team@callup.com
- **모바일 팀**: mobile-team@callup.com

---

**문서 버전**: 1.0.0
**최종 수정일**: 2025-01-24
**작성자**: Claude (AI Assistant)
