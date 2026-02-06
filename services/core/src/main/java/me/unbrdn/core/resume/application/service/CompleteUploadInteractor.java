package me.unbrdn.core.resume.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.resume.application.dto.CompleteUploadCommand;
import me.unbrdn.core.resume.application.port.in.CompleteUploadUseCase;
import me.unbrdn.core.resume.application.port.out.GeneratePresignedUrlPort;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.ProduceResumeEventPort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompleteUploadInteractor implements CompleteUploadUseCase {

    private final LoadResumePort loadResumePort;
    private final SaveResumePort saveResumePort;
    private final ProduceResumeEventPort produceResumeEventPort;
    private final GeneratePresignedUrlPort generatePresignedUrlPort;

    @Override
    @Transactional
    public void execute(CompleteUploadCommand command) {
        // 1. 이력서 조회
        Resumes resume = loadResumePort.loadResumeById(command.getResumeId())
                .orElseThrow(() -> new IllegalArgumentException("이력서를 찾을 수 없습니다. ID: " + command.getResumeId()));

        // 2. 상태 변경 (PROCESSING)
        resume.startProcessing();
        saveResumePort.save(resume);

        // 3. 분석용 다운로드 URL 생성 (1시간 유효)
        String downloadUrl = generatePresignedUrlPort.generateDownloadUrl(resume.getFilePath());

        // 4. Kafka 분석 요청 이벤트 발행
        produceResumeEventPort.sendProcessEvent(resume.getId(), resume.getFilePath(), downloadUrl);

        log.info("이력서 업로드 완료 처리 및 분석 이벤트 발행: resumeId={}, downloadUrl={}", resume.getId(), downloadUrl);
    }
}
