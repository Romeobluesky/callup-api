# CallUp 데이터베이스 스키마 설계

## 데이터베이스 생성

```sql
CREATE DATABASE IF NOT EXISTS callup_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE callup_db;
```

---

## 1. users (상담원 정보)

```sql
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '상담원 ID',
    user_login_id VARCHAR(50) UNIQUE NOT NULL COMMENT '로그인 아이디',
    user_name VARCHAR(50) NOT NULL COMMENT '상담원 이름',
    user_password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
    user_phone VARCHAR(20) COMMENT '상담원 전화번호',
    user_status_message VARCHAR(200) COMMENT '상태 메시지',
    is_active BOOLEAN DEFAULT TRUE COMMENT '활성 상태',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '가입일',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일',

    INDEX idx_login_id (user_login_id),
    INDEX idx_name (user_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='상담원 정보';
```

---

## 2. db_lists (DB 리스트)

```sql
CREATE TABLE db_lists (
    db_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'DB ID',
    db_title VARCHAR(100) NOT NULL COMMENT 'DB 제목',
    db_date DATE NOT NULL COMMENT 'DB 날짜',
    total_count INT DEFAULT 0 COMMENT '총 고객 수',
    unused_count INT DEFAULT 0 COMMENT '미사용 고객 수',
    file_name VARCHAR(255) COMMENT '원본 파일명',
    is_active BOOLEAN DEFAULT TRUE COMMENT '활성 상태 (ON/OFF)',
    upload_date DATE NOT NULL COMMENT '업로드 날짜',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일',

    INDEX idx_db_date (db_date),
    INDEX idx_db_title (db_title),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DB 리스트';
```

---

## 3. customers (고객 정보)

```sql
CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '고객 ID',
    db_id INT NOT NULL COMMENT 'DB ID (외래키)',

    -- CSV 기본 정보 (0-6번 컬럼)
    event_name VARCHAR(100) COMMENT '이벤트명',
    customer_phone VARCHAR(20) NOT NULL COMMENT '전화번호',
    customer_name VARCHAR(50) NOT NULL COMMENT '고객명',
    customer_info1 VARCHAR(200) COMMENT '고객정보1 (관리자 자유 입력)',
    customer_info2 VARCHAR(200) COMMENT '고객정보2 (관리자 자유 입력)',
    customer_info3 VARCHAR(200) COMMENT '고객정보3 (관리자 자유 입력)',

    -- CSV 통화 관련 정보 (7-16번 컬럼)
    data_status ENUM('미사용', '사용완료') DEFAULT '미사용' COMMENT '데이터 상태 (DB 사용 여부)',
    call_result VARCHAR(100) COMMENT '통화 결과',
    consultation_result TEXT COMMENT '상담 결과',
    memo TEXT COMMENT '메모',
    call_datetime DATETIME COMMENT '통화 일시',
    call_start_time TIME COMMENT '통화 시작 시간',
    call_end_time TIME COMMENT '통화 종료 시간',
    call_duration VARCHAR(20) COMMENT '통화 시간 (HH:MM:SS)',
    reservation_date DATE COMMENT '통화 예약일',
    reservation_time TIME COMMENT '통화 예약 시간',

    -- CSV 메타 정보 (17-18번 컬럼)
    upload_date DATE COMMENT '업로드 날짜',
    last_modified_date DATETIME COMMENT '최종 수정일',

    -- 추가 정보
    has_audio BOOLEAN DEFAULT FALSE COMMENT '통화 녹음 여부',
    audio_file_path VARCHAR(500) COMMENT '녹음 파일 경로',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '시스템 최종 수정일',

    FOREIGN KEY (db_id) REFERENCES db_lists(db_id) ON DELETE CASCADE,
    INDEX idx_db_id (db_id),
    INDEX idx_phone (customer_phone),
    INDEX idx_name (customer_name),
    INDEX idx_data_status (data_status),
    INDEX idx_call_datetime (call_datetime),
    INDEX idx_reservation_date (reservation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='고객 정보';
```

---

## 4. call_logs (통화 로그)

```sql
CREATE TABLE call_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '로그 ID',
    user_id INT NOT NULL COMMENT '상담원 ID (외래키)',
    customer_id INT NOT NULL COMMENT '고객 ID (외래키)',
    db_id INT NOT NULL COMMENT 'DB ID (외래키)',

    call_datetime DATETIME NOT NULL COMMENT '통화 일시',
    call_start_time TIME COMMENT '통화 시작 시간',
    call_end_time TIME COMMENT '통화 종료 시간',
    call_duration VARCHAR(20) COMMENT '통화 시간 (HH:MM:SS)',
    call_result VARCHAR(100) COMMENT '통화 결과',
    consultation_result TEXT COMMENT '상담 결과',
    memo TEXT COMMENT '메모',

    has_audio BOOLEAN DEFAULT FALSE COMMENT '통화 녹음 여부',
    audio_file_path VARCHAR(500) COMMENT '녹음 파일 경로',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (db_id) REFERENCES db_lists(db_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_db_id (db_id),
    INDEX idx_call_datetime (call_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='통화 로그';
```

---

## 5. statistics (통계 정보)

```sql
CREATE TABLE statistics (
    stat_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '통계 ID',
    user_id INT NOT NULL COMMENT '상담원 ID (외래키)',
    stat_date DATE NOT NULL COMMENT '통계 날짜',

    total_call_time VARCHAR(20) DEFAULT '00:00:00' COMMENT '총 통화 시간',
    total_call_count INT DEFAULT 0 COMMENT '총 통화 건수',
    success_count INT DEFAULT 0 COMMENT '통화 성공 건수',
    failed_count INT DEFAULT 0 COMMENT '통화 실패 건수',
    callback_count INT DEFAULT 0 COMMENT '재통화 건수',
    no_answer_count INT DEFAULT 0 COMMENT '무응답 건수',
    assigned_db_count INT DEFAULT 0 COMMENT '분배 DB 건수',
    unused_db_count INT DEFAULT 0 COMMENT '미사용 DB 건수',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일',

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, stat_date),
    INDEX idx_user_id (user_id),
    INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='통계 정보';
```

---

## CSV 컬럼 매핑 (고객 정보)

| CSV 인덱스 | 컬럼명 | MySQL 필드명 | 타입 | 설명 |
|-----------|--------|--------------|------|------|
| 0 | 이벤트명 | event_name | VARCHAR(100) | 이벤트 또는 캠페인 이름 |
| 1 | 전화번호 | customer_phone | VARCHAR(20) | 고객 전화번호 |
| 2 | 고객명 | customer_name | VARCHAR(50) | 고객 이름 |
| 3 | 고객정보1 | customer_info1 | VARCHAR(200) | 관리자 자유 입력 |
| 4 | 고객정보2 | customer_info2 | VARCHAR(200) | 관리자 자유 입력 |
| 5 | 고객정보3 | customer_info3 | VARCHAR(200) | 관리자 자유 입력 |
| 6 | 고객정보4 | ~~삭제됨~~ | - | ~~삭제~~ |
| 7 | 상태 | data_status | ENUM | '미사용', '사용완료' |
| 8 | 통화결과 | call_result | VARCHAR(100) | 통화 결과 |
| 9 | 상담결과 | consultation_result | TEXT | 상담 내용 |
| 10 | 메모 | memo | TEXT | 메모 |
| 11 | 통화일시 | call_datetime | DATETIME | 통화 일시 |
| 12 | 통화시작시간 | call_start_time | TIME | 통화 시작 시간 |
| 13 | 통화종료시간 | call_end_time | TIME | 통화 종료 시간 |
| 14 | 통화시간 | call_duration | VARCHAR(20) | 통화 시간 (HH:MM:SS) |
| 15 | 통화예약일 | reservation_date | DATE | 통화 예약일 |
| 16 | 통화예약시간 | reservation_time | TIME | 통화 예약 시간 |
| 17 | 업로드날짜 | upload_date | DATE | 업로드 날짜 |
| 18 | 최종수정일 | last_modified_date | DATETIME | 최종 수정일 |

---

## 샘플 데이터 삽입

### 1. 상담원 샘플 데이터

```sql
INSERT INTO users (user_login_id, user_name, user_password, user_phone, user_status_message) VALUES
('admin', '관리자', SHA2('admin1234', 256), '010-1234-5678', '오늘도 화이팅!'),
('user01', '김상담', SHA2('user1234', 256), '010-2345-6789', '열심히 일하겠습니다'),
('user02', '이상담', SHA2('user1234', 256), '010-3456-7890', '고객 만족을 위해');
```

### 2. DB 리스트 샘플 데이터

```sql
INSERT INTO db_lists (db_title, db_date, total_count, unused_count, file_name, is_active, upload_date) VALUES
('테스트01_인천', '2025-10-14', 500, 250, 'customers_incheon.csv', TRUE, '2025-10-14'),
('테스트02_경기', '2025-10-15', 300, 150, 'customers_gyeonggi.csv', TRUE, '2025-10-15'),
('테스트03_서울', '2025-10-16', 800, 400, 'customers_seoul.csv', FALSE, '2025-10-16');
```

### 3. 고객 샘플 데이터

```sql
INSERT INTO customers (
    db_id,
    event_name,
    customer_phone,
    customer_name,
    customer_info1,
    customer_info2,
    customer_info3,
    data_status,
    upload_date
) VALUES
(1, '테스트01_인천', '010-1234-5678', '김철수', '인천 부평구', '쿠팡 이벤트', '#1001', '미사용', '2025-10-14'),
(1, '테스트01_인천', '070-8666-1427', '이영희', '인천 남동구', '쿠팡 이벤트', '#1002', '미사용', '2025-10-14'),
(1, '테스트01_인천', '010-7925-1707', '박민수', '인천 계양구', '쿠팡 이벤트', '#1003', '미사용', '2025-10-14');
```

---

## 트리거 (자동 업데이트)

### 1. customers 테이블 변경 시 db_lists의 unused_count 자동 업데이트

```sql
DELIMITER $$

CREATE TRIGGER update_unused_count_after_insert
AFTER INSERT ON customers
FOR EACH ROW
BEGIN
    UPDATE db_lists
    SET unused_count = (
        SELECT COUNT(*) FROM customers
        WHERE db_id = NEW.db_id AND data_status = '미사용'
    ),
    total_count = (
        SELECT COUNT(*) FROM customers
        WHERE db_id = NEW.db_id
    )
    WHERE db_id = NEW.db_id;
END$$

CREATE TRIGGER update_unused_count_after_update
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
    UPDATE db_lists
    SET unused_count = (
        SELECT COUNT(*) FROM customers
        WHERE db_id = NEW.db_id AND data_status = '미사용'
    )
    WHERE db_id = NEW.db_id;
END$$

CREATE TRIGGER update_unused_count_after_delete
AFTER DELETE ON customers
FOR EACH ROW
BEGIN
    UPDATE db_lists
    SET unused_count = (
        SELECT COUNT(*) FROM customers
        WHERE db_id = OLD.db_id AND data_status = '미사용'
    ),
    total_count = (
        SELECT COUNT(*) FROM customers
        WHERE db_id = OLD.db_id
    )
    WHERE db_id = OLD.db_id;
END$$

DELIMITER ;
```

### 2. call_logs 삽입 시 statistics 자동 업데이트

```sql
DELIMITER $$

CREATE TRIGGER update_statistics_after_call
AFTER INSERT ON call_logs
FOR EACH ROW
BEGIN
    INSERT INTO statistics (
        user_id,
        stat_date,
        total_call_count,
        success_count,
        failed_count,
        callback_count,
        no_answer_count
    )
    VALUES (
        NEW.user_id,
        DATE(NEW.call_datetime),
        1,
        IF(NEW.call_result LIKE '%성공%', 1, 0),
        IF(NEW.call_result LIKE '%실패%' OR NEW.call_result LIKE '%부재%', 1, 0),
        IF(NEW.call_result LIKE '%재통화%' OR NEW.call_result LIKE '%재연락%', 1, 0),
        IF(NEW.call_result LIKE '%무응답%', 1, 0)
    )
    ON DUPLICATE KEY UPDATE
        total_call_count = total_call_count + 1,
        success_count = success_count + IF(NEW.call_result LIKE '%성공%', 1, 0),
        failed_count = failed_count + IF(NEW.call_result LIKE '%실패%' OR NEW.call_result LIKE '%부재%', 1, 0),
        callback_count = callback_count + IF(NEW.call_result LIKE '%재통화%' OR NEW.call_result LIKE '%재연락%', 1, 0),
        no_answer_count = no_answer_count + IF(NEW.call_result LIKE '%무응답%', 1, 0);
END$$

DELIMITER ;
```

---

## 주요 쿼리 예시

### 1. 특정 DB의 미사용 고객 목록 조회

```sql
SELECT
    customer_id,
    customer_name,
    customer_phone,
    customer_info1,
    customer_info2,
    customer_info3
FROM customers
WHERE db_id = ? AND data_status = '미사용'
ORDER BY customer_id;
```

### 2. 상담원별 오늘 통계 조회

```sql
SELECT
    u.user_name,
    s.total_call_time,
    s.total_call_count,
    s.success_count,
    s.failed_count,
    s.callback_count,
    s.no_answer_count
FROM statistics s
JOIN users u ON s.user_id = u.user_id
WHERE s.user_id = ? AND s.stat_date = CURDATE();
```

### 3. DB 리스트 조회 (미사용 개수 포함)

```sql
SELECT
    db_id,
    db_title,
    db_date,
    total_count,
    unused_count,
    is_active,
    upload_date
FROM db_lists
WHERE is_active = TRUE
ORDER BY db_date DESC;
```

### 4. 고객 검색 (이름, 전화번호, 이벤트명)

```sql
SELECT
    c.customer_id,
    c.customer_name,
    c.customer_phone,
    c.event_name,
    c.data_status,
    c.call_result,
    c.call_datetime,
    c.call_start_time,
    c.call_end_time,
    c.call_duration,
    c.consultation_result,
    c.memo,
    c.has_audio,
    c.reservation_date,
    c.reservation_time,
    d.db_date,
    d.db_title
FROM customers c
JOIN db_lists d ON c.db_id = d.db_id
WHERE
    (c.customer_name LIKE CONCAT('%', ?, '%')
    OR c.customer_phone LIKE CONCAT('%', ?, '%')
    OR c.event_name LIKE CONCAT('%', ?, '%'))
ORDER BY c.call_datetime DESC;
```

### 5. 통화 로그 기록

```sql
INSERT INTO call_logs (
    user_id,
    customer_id,
    db_id,
    call_datetime,
    call_start_time,
    call_end_time,
    call_duration,
    call_result,
    consultation_result,
    memo,
    has_audio,
    audio_file_path
) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?);
```

### 6. 고객 통화 정보 업데이트

```sql
UPDATE customers
SET
    data_status = '사용완료',
    call_result = ?,
    consultation_result = ?,
    call_datetime = NOW(),
    call_start_time = ?,
    call_end_time = ?,
    call_duration = ?,
    memo = ?,
    has_audio = ?,
    audio_file_path = ?,
    last_modified_date = NOW()
WHERE customer_id = ?;
```

### 7. 통화 예약 설정

```sql
UPDATE customers
SET
    reservation_date = ?,
    reservation_time = ?,
    memo = CONCAT(IFNULL(memo, ''), '\n[예약] ', ?, ' ', ?),
    last_modified_date = NOW()
WHERE customer_id = ?;
```

### 8. 예약된 통화 목록 조회 (오늘 기준)

```sql
SELECT
    c.customer_id,
    c.customer_name,
    c.customer_phone,
    c.reservation_date,
    c.reservation_time,
    c.memo,
    d.db_title
FROM customers c
JOIN db_lists d ON c.db_id = d.db_id
WHERE c.reservation_date = CURDATE()
AND c.data_status = '미사용'
ORDER BY c.reservation_time;
```

---

## 인덱스 최적화 전략

- **users**: user_login_id (로그인), user_name (검색)
- **db_lists**: db_date (날짜별 조회), is_active (활성 DB 필터)
- **customers**: db_id (DB별 조회), phone (중복 체크), data_status (미사용 필터), reservation_date (예약 조회)
- **call_logs**: user_id + call_datetime (상담원별 로그), customer_id (고객별 이력)
- **statistics**: user_id + stat_date (일별 통계)

---

## 백업 및 복구

### 백업

```bash
mysqldump -u root -p callup_db > callup_backup_$(date +%Y%m%d).sql
```

### 복구

```bash
mysql -u root -p callup_db < callup_backup_20251022.sql
```

---

## 보안 권장사항

1. **비밀번호 해시**: SHA2 또는 bcrypt 사용
2. **SQL Injection 방지**: Prepared Statement 사용
3. **접근 제어**: 상담원별 권한 관리
4. **정기 백업**: 일별 자동 백업 설정
5. **감사 로그**: 중요 작업 로그 기록

---

**작성일**: 2025-10-22
**버전**: 2.0.0
**수정 내역**:
- 고객정보1-3으로 축소 (관리자 자유 입력)
- 고객유형 삭제
- 통화상태 → 데이터상태로 변경 (미사용/사용완료)
- 통화시작시간, 통화종료시간 추가
- 통화예약일, 통화예약시간 추가
- 통화결과, 상담결과 분리
- CSV 컬럼 18개로 확정
