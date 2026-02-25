package me.unbrdn.core.interview.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.application.port.in.ForceStageCommand;
import me.unbrdn.core.interview.application.port.in.ForceStageResult;
import me.unbrdn.core.interview.application.port.in.ForceStageUseCase;
import me.unbrdn.core.interview.application.port.out.InterviewPort;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.InterviewStage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ForceStageInteractor
 *
 * <p>[DevTool] 개발 환경에서 면접 단계를 강제로 변경합니다. 테스트 및 디버깅 목적으로만 사용됩니다.
 *
 * <p>WARNING: 프로덕션 환경에서는 절대 사용하지 마세요!
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForceStageInteractor implements ForceStageUseCase {

    private final InterviewPort interviewPort;

    @Override
    @Transactional
    public ForceStageResult execute(ForceStageCommand command) {
        log.warn(
                "[DevTool] Force stage change requested: interviewId={}, targetStage={}",
                command.interviewId(),
                command.targetStage());

        // 면접 세션 조회
        UUID interviewId = UUID.fromString(command.interviewId());
        InterviewSession session =
                interviewPort
                        .loadById(interviewId)
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Interview not found: " + command.interviewId()));

        // 강제로 단계 변경
        InterviewStage targetStage = InterviewStage.valueOf(command.targetStage());
        session.forceChangeStage(targetStage);

        // 저장
        interviewPort.save(session);

        log.warn(
                "[DevTool] Stage forcefully changed: interviewId={}, newStage={}",
                session.getId(),
                session.getCurrentStage());

        return new ForceStageResult(
                session.getId().toString(),
                session.getCurrentStage(),
                "Stage forcefully changed to " + targetStage);
    }
}
