package me.unbrdn.core.resume.application.port.out;

import java.util.UUID;

public interface ProduceResumeEventPort {
    void sendProcessEvent(UUID resumeId, String filePath, String downloadUrl);
}
