package me.unbrdn.core.interview.application.interactor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.persistence.InterviewMapper;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewMessageJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewReportsJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.entity.InterviewSessionJpaEntity;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewMessageJpaRepository;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewReportsJpaRepository;
import me.unbrdn.core.interview.adapter.out.persistence.repository.InterviewSessionJpaRepository;
import me.unbrdn.core.interview.application.dto.result.GenerateReportResult;
import me.unbrdn.core.interview.application.port.in.CreateInterviewReportUseCase;
import me.unbrdn.core.interview.application.port.in.GetInterviewReportUseCase;
import me.unbrdn.core.interview.application.port.out.CallLlmPort;
import me.unbrdn.core.interview.domain.entity.InterviewReports;
import me.unbrdn.core.interview.domain.entity.InterviewSession;
import me.unbrdn.core.interview.domain.enums.PassFailStatus;
import me.unbrdn.core.interview.domain.enums.ReportGenerationStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerateReportInteractor implements CreateInterviewReportUseCase, GetInterviewReportUseCase {

    private final InterviewReportsJpaRepository reportsRepository;
    private final InterviewSessionJpaRepository sessionRepository;
    private final InterviewMessageJpaRepository messageJpaRepository;
    private final InterviewMapper interviewMapper;
    private final CallLlmPort callLlmPort;

    @Override
    @Transactional
    public CreateReportResult execute(CreateReportCommand command) {
        UUID interviewId = command.interviewId();

        // idempotent: 이미 리포트가 있으면 기존 reportId 반환
        Optional<InterviewReportsJpaEntity> existing = reportsRepository.findByInterviewId(interviewId);
        if (existing.isPresent()) {
            InterviewReportsJpaEntity entity = existing.get();
            log.info("Report already exists for interview {}: status={}", interviewId, entity.getGenerationStatus());
            return new CreateReportResult(entity.getId(), entity.getGenerationStatus());
        }

        // 세션 조회
        InterviewSessionJpaEntity sessionEntity = sessionRepository.findById(interviewId)
                .orElseThrow(() -> new IllegalArgumentException("Interview not found: " + interviewId));
        InterviewSession session = interviewMapper.toDomain(sessionEntity);

        // PENDING 레코드 저장
        InterviewReports report = InterviewReports.pending(session);
        InterviewReportsJpaEntity savedEntity = reportsRepository.save(interviewMapper.toJpaEntity(report));

        log.info("Created PENDING report {} for interview {}", savedEntity.getId(), interviewId);

        // 비동기 생성 시작
        generateReportAsync(interviewId, savedEntity.getId());

        return new CreateReportResult(savedEntity.getId(), ReportGenerationStatus.PENDING);
    }

    @Async
    public void generateReportAsync(UUID interviewId, UUID reportId) {
        log.info("Starting async report generation: interviewId={}, reportId={}", interviewId, reportId);

        InterviewReportsJpaEntity entity = reportsRepository.findById(reportId).orElse(null);
        if (entity == null) {
            log.error("Report entity not found: reportId={}", reportId);
            return;
        }

        InterviewReports report = interviewMapper.toDomain(entity);

        try {
            List<InterviewMessageJpaEntity> messages = messageJpaRepository
                    .findByInterview_IdOrderByCreatedAtAsc(interviewId);

            GenerateReportResult result = callLlmPort.generateReport(interviewId.toString(), messages);

            report.complete(result.getTotalScore(), result.getPassFailStatus(), result.getSummaryText(),
                    result.getResumeFeedback());

            log.info("Report generation completed: reportId={}, score={}, status={}", reportId, result.getTotalScore(),
                    result.getPassFailStatus());

        } catch (Exception e) {
            report.fail();
            log.error("Report generation failed: reportId={}, interviewId={}", reportId, interviewId, e);
        }

        reportsRepository.save(interviewMapper.toJpaEntity(report));
    }

    // CLOSING_GREETING 단계에서 미리 트리거 (idempotent)
    @Async
    public void triggerReportGeneration(UUID interviewId) {
        log.info("Triggering report pre-generation at CLOSING_GREETING: interviewId={}", interviewId);
        try {
            execute(new CreateReportCommand(interviewId));
        } catch (Exception e) {
            log.error("Failed to trigger report generation: interviewId={}", interviewId, e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public GetReportResult execute(GetReportQuery query) {
        InterviewReportsJpaEntity entity = reportsRepository.findById(query.reportId())
                .orElseThrow(() -> new IllegalArgumentException("Report not found: " + query.reportId()));

        return new GetReportResult(entity.getId(), entity.getGenerationStatus(),
                entity.getTotalScore() != null ? entity.getTotalScore() : 0,
                entity.getPassFailStatus() != null ? entity.getPassFailStatus() : PassFailStatus.HOLD,
                entity.getSummaryText(), entity.getResumeFeedback());
    }
}
