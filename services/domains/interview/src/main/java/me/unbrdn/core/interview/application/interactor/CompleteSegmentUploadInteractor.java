package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.CompleteSegmentUploadUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.LoadRecordingSegmentsPort;
import me.unbrdn.core.interview.application.port.out.SaveRecordingSegmentPort;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompleteSegmentUploadInteractor implements CompleteSegmentUploadUseCase {

    private final SaveRecordingSegmentPort saveRecordingSegmentPort;
    private final LoadRecordingSegmentsPort loadRecordingSegmentsPort;
    private final InterviewPort interviewPort;

    @Override
    @Transactional
    public void execute(CompleteSegmentCommand command) {
        var session =
                interviewPort
                        .loadById(command.interviewId())
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + command.interviewId()));

        if (session.getStatus()
                == me.unbrdn.core.interview.domain.enums.InterviewSessionStatus.PAUSED) {
            log.warn("Completing segment upload for a paused interview: {}", command.interviewId());
        }

        var existingSegment =
                loadRecordingSegmentsPort.loadByInterviewSessionIdAndTurnCount(
                        command.interviewId(), command.turnCount());

        if (existingSegment.isPresent()) {
            var segment = existingSegment.get();
            segment.updateDetails(
                    command.objectKey(),
                    command.durationSeconds(),
                    command.startedAt(),
                    command.endedAt());
            saveRecordingSegmentPort.save(segment);
            log.info(
                    "Updated existing recording segment: interviewId={}, turn={}, objectKey={}",
                    command.interviewId(),
                    command.turnCount(),
                    command.objectKey());
            return;
        }

        var segment =
                InterviewRecordingSegment.create(
                        session,
                        command.turnCount(),
                        command.objectKey(),
                        command.durationSeconds(),
                        command.startedAt(),
                        command.endedAt());

        saveRecordingSegmentPort.save(segment);

        log.info(
                "Saved new recording segment: interviewId={}, turn={}, objectKey={}",
                command.interviewId(),
                command.turnCount(),
                command.objectKey());
    }
}
