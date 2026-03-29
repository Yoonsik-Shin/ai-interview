package me.unbrdn.core.interview.application.interactor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewMessageJpaRepository;
import me.unbrdn.core.interview.application.port.in.GetInterviewRecordingSegmentsUseCase;
import me.unbrdn.core.interview.application.port.out.GetSegmentStorageUrlPort;
import me.unbrdn.core.interview.application.port.out.LoadRecordingSegmentsPort;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;
import me.unbrdn.core.interview.domain.enums.MessageRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetInterviewRecordingSegmentsInteractor
        implements GetInterviewRecordingSegmentsUseCase {

    private static final int DOWNLOAD_URL_EXPIRATION_SECONDS = 3600;

    private final LoadRecordingSegmentsPort loadRecordingSegmentsPort;
    private final GetSegmentStorageUrlPort storageUrlPort;
    private final InterviewMessageJpaRepository messageRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SegmentResult> execute(GetSegmentsQuery query) {
        List<InterviewRecordingSegment> segments =
                loadRecordingSegmentsPort.loadByInterviewSessionId(query.interviewId());

        List<InterviewMessageJpaEntity> messages =
                messageRepository.findByInterview_IdOrderByCreatedAtAsc(query.interviewId());

        // Group messages by turnCount
        Map<Integer, List<InterviewMessageJpaEntity>> messagesByTurn =
                messages.stream()
                        .collect(
                                Collectors.groupingBy(
                                        m -> m.getTurnCount() != null ? m.getTurnCount() : 0));

        return segments.stream()
                .map(
                        segment -> {
                            String url =
                                    storageUrlPort.getDownloadUrl(
                                            segment.getObjectKey(),
                                            DOWNLOAD_URL_EXPIRATION_SECONDS);
                            if (url == null) {
                                log.warn(
                                        "Failed to generate download URL for objectKey={}",
                                        segment.getObjectKey());
                                return null;
                            }
                            long expiresAt =
                                    Instant.now()
                                            .plusSeconds(DOWNLOAD_URL_EXPIRATION_SECONDS)
                                            .toEpochMilli();

                            List<InterviewMessageJpaEntity> turnMessages =
                                    messagesByTurn.getOrDefault(segment.getTurnCount(), List.of());

                            String questionContent =
                                    turnMessages.stream()
                                            .filter(m -> m.getRole() == MessageRole.AI)
                                            .map(InterviewMessageJpaEntity::getContent)
                                            .collect(Collectors.joining("\n"));

                            String answerContent =
                                    turnMessages.stream()
                                            .filter(m -> m.getRole() == MessageRole.USER)
                                            .map(InterviewMessageJpaEntity::getContent)
                                            .collect(Collectors.joining("\n"));

                            String questionAudioUrl =
                                    turnMessages.stream()
                                            .filter(
                                                    m ->
                                                            m.getRole() == MessageRole.AI
                                                                    && m.getMediaUrl() != null)
                                            .map(InterviewMessageJpaEntity::getMediaUrl)
                                            .findFirst()
                                            .orElse("");

                            String answerAudioUrl =
                                    turnMessages.stream()
                                            .filter(
                                                    m ->
                                                            m.getRole() == MessageRole.USER
                                                                    && m.getMediaUrl() != null)
                                            .map(InterviewMessageJpaEntity::getMediaUrl)
                                            .findFirst()
                                            .orElse("");

                            return new SegmentResult(
                                    segment.getTurnCount(),
                                    url,
                                    expiresAt,
                                    questionContent,
                                    answerContent,
                                    questionAudioUrl,
                                    answerAudioUrl);
                        })
                .filter(r -> r != null)
                .toList();
    }
}
