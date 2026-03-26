CREATE TABLE interview_recording_segments (
    id UUID PRIMARY KEY,
    interview_session_id UUID NOT NULL,
    turn_count INTEGER NOT NULL,
    object_key VARCHAR(1024) NOT NULL,
    duration_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    analysis_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_recording_segments_session FOREIGN KEY (interview_session_id) REFERENCES interview_session(id)
);

CREATE INDEX idx_recording_segments_session_id ON interview_recording_segments(interview_session_id);
