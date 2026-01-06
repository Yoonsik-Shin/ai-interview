package com.example.core.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.core.domain.entity.Interviews;
import com.example.core.domain.entity.Resumes;
import com.example.core.domain.entity.Users;
import com.example.core.domain.enums.InterviewPersona;
import com.example.core.domain.enums.InterviewStatus;
import com.example.core.domain.enums.InterviewType;
import com.example.core.domain.repository.InterviewRepository;
import com.example.core.domain.repository.ResumesRepository;
import com.example.core.domain.repository.UsersRepository;
import com.example.core.grpc.CreateInterviewRequest;
import com.example.core.grpc.InterviewPersonaProto;
import com.example.core.grpc.InterviewTypeProto;

import lombok.RequiredArgsConstructor;

@Service // 스프링 빈으로 등록
@RequiredArgsConstructor // final 필드 생성자 자동 주입
public class InterviewService {

  // DB 작업을 위해 필요한 리포지토리들 주입
  private final InterviewRepository interviewRepository;
  private final UsersRepository usersRepository;
  private final ResumesRepository resumesRepository;

  /**
   * 실제 DB에 면접 정보를 저장하는 비즈니스 로직
   * 
   * @param request gRPC에서 변환되어 넘어온 요청 DTO
   * @return 생성된 면접의 ID (PK)
   */
  @Transactional // 트랜잭션 처리 (저장 중 실패하면 롤백)
  public Long createInterview(CreateInterviewRequest request) {

    // 1. 연관된 사용자 조회 (없으면 예외 발생 - 실무에선 커스텀 예외 권장)
    Users user = usersRepository.findById(request.getUserId())
        .orElseThrow(() -> new IllegalArgumentException("해당 사용자를 찾을 수 없습니다. ID: " + request.getUserId()));

    // 2. 연관된 이력서 조회 (없으면 예외 발생)
    Resumes resume = resumesRepository.findById(request.getResumeId())
        .orElseThrow(() -> new IllegalArgumentException("해당 이력서를 찾을 수 없습니다. ID: " + request.getResumeId()));

    InterviewType domainType = toDomainInterviewType(request.getType());
    InterviewPersona domainPersona = toDomainInterviewPersona(request.getPersona());

    // 3. Interviews 엔티티 객체 생성 (Builder 패턴 활용)
    // DTO의 값들과 조회한 연관 객체들을 조립합니다.
    Interviews interview = Interviews.builder().user(user).resume(resume).domain(request.getDomain()).type(domainType) // gRPC
                                                                                                                       // Enum
                                                                                                                       // ->
                                                                                                                       // 도메인
                                                                                                                       // Enum
                                                                                                                       // 변환
        // 🔥 중요: 초기 상태는 항상 'READY'로 설정
        .status(InterviewStatus.READY).persona(domainPersona) // gRPC Enum -> 도메인 Enum 변환
        .interviewerCount(request.getInterviewerCount()).targetDurationMinutes(request.getTargetDurationMinutes())
        .selfIntroduction(request.getSelfIntroduction()).build();

    // 4. 리포지토리를 통해 DB에 저장 (INSERT 쿼리 실행)
    Interviews savedInterview = interviewRepository.save(interview);

    // 5. DB에서 생성된 PK(ID) 값을 반환
    return savedInterview.getInterviewId();
  }

  private static InterviewType toDomainInterviewType(InterviewTypeProto proto) {
    if (proto == null) {
      return InterviewType.TEXT_CHAT;
    }
    return switch (proto) {
    case TEXT_CHAT -> InterviewType.TEXT_CHAT;
    case VIDEO_CALL -> InterviewType.VIDEO_CALL;
    case INTERVIEW_TYPE_UNSPECIFIED, UNRECOGNIZED -> InterviewType.TEXT_CHAT;
    };
  }

  private static InterviewPersona toDomainInterviewPersona(InterviewPersonaProto proto) {
    if (proto == null) {
      return InterviewPersona.RANDOM;
    }
    return switch (proto) {
    case PRESSURE -> InterviewPersona.PRESSURE;
    case COMFORTABLE -> InterviewPersona.COMFORTABLE;
    case RANDOM -> InterviewPersona.RANDOM;
    case INTERVIEW_PERSONA_UNSPECIFIED, UNRECOGNIZED -> InterviewPersona.RANDOM;
    };
  }
}