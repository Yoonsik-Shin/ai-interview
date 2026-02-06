package me.unbrdn.core.resume.application.port.in;

import me.unbrdn.core.resume.application.dto.CompleteUploadCommand;

public interface CompleteUploadUseCase {
    void execute(CompleteUploadCommand command);
}
