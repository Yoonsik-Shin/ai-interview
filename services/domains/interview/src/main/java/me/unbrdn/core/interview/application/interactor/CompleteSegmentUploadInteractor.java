package me.unbrdn.core.interview.application.interactor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.CompleteSegmentUploadUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.application.port.out.SaveRecordingSegmentPort;
import me.unbrdn.core.interview.domain.entity.InterviewRecordingSegment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompleteSegmentUploadInteractor implements CompleteSegmentUploadUseCase {

    private final SaveRecordingSegmentPort saveRecordingSegmentPort;
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
                "Saved recording segment: interviewId={}, turn={}, objectKey={}",
                command.interviewId(),
                command.turnCount(),
                command.objectKey());
    }
}
