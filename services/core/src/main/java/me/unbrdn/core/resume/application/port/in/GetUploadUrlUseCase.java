package me.unbrdn.core.resume.application.port.in;

import me.unbrdn.core.resume.application.dto.GetUploadUrlCommand;
import me.unbrdn.core.resume.application.dto.GetUploadUrlResult;

public interface GetUploadUrlUseCase {
    GetUploadUrlResult execute(GetUploadUrlCommand command);
}
