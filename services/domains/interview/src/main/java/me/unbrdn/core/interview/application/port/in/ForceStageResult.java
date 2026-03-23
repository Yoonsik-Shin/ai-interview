package me.unbrdn.core.interview.application.port.in;

import me.unbrdn.core.interview.domain.enums.InterviewStage;

public record ForceStageResult(String interviewId, InterviewStage currentStage, String message) {}
