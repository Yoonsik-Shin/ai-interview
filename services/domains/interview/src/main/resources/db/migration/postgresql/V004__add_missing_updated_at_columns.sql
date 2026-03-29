-- interview_adjustment_log에 updated_at 추가
ALTER TABLE interview_adjustment_log ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
UPDATE interview_adjustment_log SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE interview_adjustment_log ALTER COLUMN updated_at SET NOT NULL;

-- interview_messages에 updated_at 추가
ALTER TABLE interview_messages ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
UPDATE interview_messages SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE interview_messages ALTER COLUMN updated_at SET NOT NULL;
