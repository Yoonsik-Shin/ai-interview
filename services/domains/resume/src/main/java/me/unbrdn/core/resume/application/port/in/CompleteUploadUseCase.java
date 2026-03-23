package me.unbrdn.core.resume.application.port.in;

import me.unbrdn.core.resume.application.dto.CompleteUploadCommand;
import me.unbrdn.core.resume.application.dto.CompleteUploadResult;

public interface CompleteUploadUseCase {
    CompleteUploadResult execute(CompleteUploadCommand command);
}
