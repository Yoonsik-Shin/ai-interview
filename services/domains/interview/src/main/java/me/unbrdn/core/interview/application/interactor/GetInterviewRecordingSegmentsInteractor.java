package me.unbrdn.core.interview.application.interactor;

import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.GetInterviewRecordingSegmentsUseCase;
import me.unbrdn.core.interview.application.port.out.GetSegmentStorageUrlPort;
import me.unbrdn.core.interview.application.port.out.LoadRecordingSegmentsPort;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetInterviewRecordingSegmentsInteractor implements GetInterviewRecordingSegmentsUseCase {

    private static final int DOWNLOAD_URL_EXPIRATION_SECONDS = 3600;

    private final LoadRecordingSegmentsPort loadRecordingSegmentsPort;
    private final GetSegmentStorageUrlPort storageUrlPort;

    @Override
    @Transactional(readOnly = true)
    public List<SegmentResult> execute(GetSegmentsQuery query) {
        List<InterviewRecordingSegment> segments =
                loadRecordingSegmentsPort.loadByInterviewSessionId(query.interviewId());

        return segments.stream()
                .map(segment -> {
                    String url = storageUrlPort.getDownloadUrl(
                            segment.getObjectKey(), DOWNLOAD_URL_EXPIRATION_SECONDS);
                    if (url == null) {
                        log.warn("Failed to generate download URL for objectKey={}", segment.getObjectKey());
                        return null;
                    }
                    long expiresAt = Instant.now()
                            .plusSeconds(DOWNLOAD_URL_EXPIRATION_SECONDS)
                            .toEpochMilli();
                    return new SegmentResult(segment.getTurnCount(), url, expiresAt);
                })
                .filter(r -> r != null)
                .toList();
    }
}
