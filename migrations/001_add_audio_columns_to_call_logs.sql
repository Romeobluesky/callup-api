-- Migration: Add audio recording columns to call_logs table
-- Date: 2025-11-01
-- Purpose: Support audio file upload and management system

-- Add audio-related columns to call_logs table
ALTER TABLE call_logs ADD COLUMN has_audio BOOLEAN DEFAULT FALSE COMMENT '녹음 파일 존재 여부';
ALTER TABLE call_logs ADD COLUMN audio_file_path VARCHAR(500) COMMENT '녹음 파일 저장 경로';
ALTER TABLE call_logs ADD COLUMN audio_file_size BIGINT COMMENT '파일 크기 (바이트)';
ALTER TABLE call_logs ADD COLUMN audio_duration INT COMMENT '녹음 시간 (초)';
ALTER TABLE call_logs ADD COLUMN audio_format VARCHAR(10) COMMENT '파일 형식 (m4a, mp3, amr)';
ALTER TABLE call_logs ADD COLUMN original_filename VARCHAR(255) COMMENT '원본 파일명';
ALTER TABLE call_logs ADD COLUMN uploaded_at TIMESTAMP NULL COMMENT '업로드 시간';
ALTER TABLE call_logs ADD COLUMN upload_status ENUM('pending', 'uploading', 'completed', 'failed') DEFAULT 'pending' COMMENT '업로드 상태';

-- Add indexes for performance optimization
CREATE INDEX idx_call_logs_has_audio ON call_logs(has_audio);
CREATE INDEX idx_call_logs_upload_status ON call_logs(upload_status);
CREATE INDEX idx_call_logs_call_datetime ON call_logs(call_datetime);
CREATE INDEX idx_call_logs_user_datetime ON call_logs(user_id, call_datetime);

-- Rollback script (if needed)
-- ALTER TABLE call_logs DROP COLUMN has_audio;
-- ALTER TABLE call_logs DROP COLUMN audio_file_path;
-- ALTER TABLE call_logs DROP COLUMN audio_file_size;
-- ALTER TABLE call_logs DROP COLUMN audio_duration;
-- ALTER TABLE call_logs DROP COLUMN audio_format;
-- ALTER TABLE call_logs DROP COLUMN original_filename;
-- ALTER TABLE call_logs DROP COLUMN uploaded_at;
-- ALTER TABLE call_logs DROP COLUMN upload_status;
-- DROP INDEX idx_call_logs_has_audio ON call_logs;
-- DROP INDEX idx_call_logs_upload_status ON call_logs;
-- DROP INDEX idx_call_logs_call_datetime ON call_logs;
-- DROP INDEX idx_call_logs_user_datetime ON call_logs;
