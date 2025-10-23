# CallUp API 배포 가이드

## 서버 환경
- **서버 주소**: 1.234.2.37
- **API URL**: https://api.autocallup.com
- **데이터베이스**: MySQL 8.0+

---

## 1. 사전 준비

### 1.1 서버 접속
```bash
ssh user@1.234.2.37
```

### 1.2 필수 소프트웨어 설치
```bash
# Node.js 18+ 설치 (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 설치 (프로세스 관리자)
sudo npm install -g pm2

# Nginx 설치 (리버스 프록시)
sudo apt-get install -y nginx

# MySQL 클라이언트 설치
sudo apt-get install -y mysql-client
```

---

## 2. 데이터베이스 설정

### 2.1 MySQL 접속
```bash
mysql -h 1.234.2.37 -u root -p
```

### 2.2 데이터베이스 및 사용자 생성
```sql
-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS callup_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 사용자 생성 및 권한 부여
CREATE USER 'callup_user'@'%' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON callup_db.* TO 'callup_user'@'%';
FLUSH PRIVILEGES;
```

### 2.3 테이블 생성
```bash
# DATABASE_SCHEMA.md 파일의 SQL을 실행
mysql -h 1.234.2.37 -u callup_user -p callup_db < database_schema.sql
```

---

## 3. 애플리케이션 배포

### 3.1 프로젝트 클론
```bash
# 프로젝트 디렉토리 생성
sudo mkdir -p /var/www/callup-api
sudo chown $USER:$USER /var/www/callup-api

# Git 클론
cd /var/www
git clone https://github.com/Romeobluesky/callup-api.git
cd callup-api
```

### 3.2 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env
nano .env
```

`.env` 파일 내용:
```env
# API Configuration
NODE_ENV=production
PORT=3000
API_URL=https://api.autocallup.com

# Database Configuration
DB_HOST=1.234.2.37
DB_PORT=3306
DB_USER=callup_user
DB_PASSWORD=your_secure_password
DB_NAME=callup_db
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_WAIT_FOR_CONNECTIONS=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-change-this
JWT_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=*
```

### 3.3 패키지 설치 및 빌드
```bash
# 의존성 설치
npm install

# 프로덕션 빌드
npm run build
```

### 3.4 PM2로 애플리케이션 실행
```bash
# PM2 ecosystem 파일 사용
pm2 start ecosystem.config.js

# PM2 저장 (재부팅 시 자동 시작)
pm2 save
pm2 startup
```

### 3.5 PM2 상태 확인
```bash
# 프로세스 상태 확인
pm2 status

# 로그 확인
pm2 logs callup-api

# 모니터링
pm2 monit
```

---

## 4. Nginx 설정 (리버스 프록시)

### 4.1 Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/api.autocallup.com
```

설정 내용:
```nginx
server {
    listen 80;
    server_name api.autocallup.com;

    # 최대 업로드 크기 (CSV 파일용)
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS 헤더 (이미 애플리케이션에서 처리하지만 백업용)
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    }
}
```

### 4.2 Nginx 설정 활성화
```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/api.autocallup.com /etc/nginx/sites-enabled/

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

### 4.3 SSL 인증서 설정 (Let's Encrypt)
```bash
# Certbot 설치
sudo apt-get install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d api.autocallup.com

# 자동 갱신 설정 확인
sudo certbot renew --dry-run
```

---

## 5. 방화벽 설정

```bash
# UFW 활성화 (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3306/tcp  # MySQL (필요시)
sudo ufw enable

# 방화벽 상태 확인
sudo ufw status
```

---

## 6. 데이터베이스 연결 테스트

```bash
# API 서버에서 데이터베이스 연결 테스트
curl http://localhost:3000/api/db/test

# 외부에서 테스트
curl https://api.autocallup.com/api/db/test
```

---

## 7. 테스트 사용자 생성

```sql
-- 테스트 사용자 추가 (비밀번호: password123)
INSERT INTO users (
  user_login_id,
  user_name,
  user_password,
  user_phone,
  user_status_message,
  is_active
) VALUES (
  'admin01',
  '김상담',
  '$2a$10$X7V0xB3CvQG8I7V0xB3CvO7V0xB3CvQG8I7V0xB3CvQG8I7V0xB3C.',  -- bcrypt hash of 'password123'
  '010-1234-5678',
  '오늘도 화이팅!',
  TRUE
);
```

비밀번호 해시 생성 (Node.js):
```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('password123', 10);
console.log(hash);
```

---

## 8. API 테스트

### 8.1 로그인 테스트
```bash
curl -X POST https://api.autocallup.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "admin01",
    "userName": "김상담",
    "password": "password123"
  }'
```

### 8.2 대시보드 테스트 (JWT 토큰 필요)
```bash
curl -X GET https://api.autocallup.com/api/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 9. 모니터링 및 유지보수

### 9.1 PM2 명령어
```bash
# 프로세스 재시작
pm2 restart callup-api

# 프로세스 중지
pm2 stop callup-api

# 로그 보기
pm2 logs callup-api --lines 100

# 에러 로그만 보기
pm2 logs callup-api --err --lines 50
```

### 9.2 배포 업데이트
```bash
cd /var/www/callup-api

# 최신 코드 가져오기
git pull origin main

# 의존성 업데이트
npm install

# 빌드
npm run build

# PM2 재시작
pm2 restart callup-api
```

### 9.3 데이터베이스 백업
```bash
# 백업
mysqldump -h 1.234.2.37 -u callup_user -p callup_db > callup_backup_$(date +%Y%m%d).sql

# 복구
mysql -h 1.234.2.37 -u callup_user -p callup_db < callup_backup_20251023.sql
```

---

## 10. 문제 해결

### 10.1 데이터베이스 연결 오류
```bash
# MySQL 서비스 상태 확인
sudo systemctl status mysql

# MySQL 포트 확인
netstat -an | grep 3306

# MySQL 로그 확인
sudo tail -f /var/log/mysql/error.log
```

### 10.2 Nginx 오류
```bash
# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log

# Nginx 설정 테스트
sudo nginx -t
```

### 10.3 애플리케이션 오류
```bash
# PM2 로그 확인
pm2 logs callup-api --lines 200

# 환경 변수 확인
pm2 env 0
```

---

## 11. 보안 권장사항

1. **JWT Secret**: 32자 이상의 랜덤 문자열 사용
2. **Database Password**: 강력한 비밀번호 사용
3. **CORS**: 프로덕션에서는 특정 도메인만 허용
4. **Rate Limiting**: API 호출 제한 설정 (추후 구현)
5. **HTTPS**: 반드시 SSL 인증서 사용
6. **방화벽**: 불필요한 포트 차단
7. **정기 업데이트**: 패키지 및 시스템 업데이트
8. **백업**: 정기적인 데이터베이스 백업

---

## 12. Flutter 앱 연동

Flutter 앱에서 API 호출 시:

```dart
// API Base URL
const String apiBaseUrl = 'https://api.autocallup.com';

// 로그인 예제
final response = await http.post(
  Uri.parse('$apiBaseUrl/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'userId': 'admin01',
    'userName': '김상담',
    'password': 'password123',
  }),
);

// JWT 토큰 저장
final token = jsonDecode(response.body)['data']['token'];

// 인증이 필요한 API 호출
final dashboardResponse = await http.get(
  Uri.parse('$apiBaseUrl/api/dashboard'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  },
);
```

---

## 참고 문서
- API 엔드포인트: `API_ENDPOINTS.md`
- 데이터베이스 스키마: `.claude/DATABASE_SCHEMA.md`
- API 서버 사양: `.claude/API_SERVER_SPEC.md`
