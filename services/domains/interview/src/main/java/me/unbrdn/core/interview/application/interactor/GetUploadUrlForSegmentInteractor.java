package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.GetUploadUrlForSegmentUseCase;
import me.unbrdn.core.interview.application.port.out.GetSegmentStorageUrlPort;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetUploadUrlForSegmentInteractor implements GetUploadUrlForSegmentUseCase {

    private static final int UPLOAD_URL_EXPIRATION_SECONDS = 600;

    private final GetSegmentStorageUrlPort storageUrlPort;
    private final InterviewPort interviewPort;

    @Override
    public GetUploadUrlResult execute(GetUploadUrlCommand command) {
        UUID interviewId = command.interviewId();

        var session =
                interviewPort
                        .loadById(interviewId)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + interviewId));

        if (session.getStatus()
                == me.unbrdn.core.interview.domain.enums.InterviewSessionStatus.PAUSED) {
            throw new IllegalStateException(
                    "Cannot get upload URL for a paused interview: " + interviewId);
        }

        String objectKey =
                String.format(
                        "interviews/%s/video/turn-%d/%s.webm",
                        interviewId, command.turnCount(), UUID.randomUUID());

        String uploadUrl = storageUrlPort.getUploadUrl(objectKey, UPLOAD_URL_EXPIRATION_SECONDS);
        if (uploadUrl == null) {
            throw new IllegalStateException("Failed to generate upload URL from storage service");
        }

        log.debug(
                "Generated upload URL for interview={}, turn={}, objectKey={}",
                interviewId,
                command.turnCount(),
                objectKey);

        return new GetUploadUrlResult(uploadUrl, objectKey);
    }
}
