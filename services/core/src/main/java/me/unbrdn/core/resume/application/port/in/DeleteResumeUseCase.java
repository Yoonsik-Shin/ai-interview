package me.unbrdn.core.resume.application.port.in;

public interface DeleteResumeUseCase {
    boolean deleteResume(String resumeId, String userId);
}
