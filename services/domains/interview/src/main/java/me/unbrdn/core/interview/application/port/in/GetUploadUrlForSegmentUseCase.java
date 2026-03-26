package me.unbrdn.core.interview.application.port.in;

import java.util.UUID;

public interface GetUploadUrlForSegmentUseCase {

    record GetUploadUrlCommand(UUID interviewId, int turnCount) {}

    record GetUploadUrlResult(String uploadUrl, String objectKey) {}

    GetUploadUrlResult execute(GetUploadUrlCommand command);
}
