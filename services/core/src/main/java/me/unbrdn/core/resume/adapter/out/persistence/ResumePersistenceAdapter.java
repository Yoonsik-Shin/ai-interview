package me.unbrdn.core.resume.adapter.out.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.resume.application.port.out.LoadResumePort;
import me.unbrdn.core.resume.application.port.out.LoadResumesByUserPort;
import me.unbrdn.core.resume.application.port.out.LoadUserPort;
import me.unbrdn.core.resume.application.port.out.SaveResumePort;
import me.unbrdn.core.resume.domain.entity.Resumes;
import me.unbrdn.core.resume.domain.repository.ResumesRepository;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.user.domain.repository.UsersRepository;
import org.springframework.stereotype.Component;

/**
 * 이력서 Persistence Adapter
 *
 * <p>
 * Output Adapter: Application Layer의 Port를 구현하여 JPA Repository를 래핑합니다.
 *
 * <p>
 * 현재는 모놀리식 환경에서 같은 DB의 UsersRepository를 직접 접근합니다. 향후 서버 분리 시에는 LoadUserPort 구현을
 * 별도의 UserGrpcAdapter로 분리하여 gRPC 클라이언트로 User 서비스를 호출합니다.
 *
 * <p>
 * 서버 분리 전략:
 *
 * <ul>
 * <li>현재: UsersRepository 직접 접근 (같은 DB)
 * <li>분리 후: UserGrpcAdapter 생성하여 LoadUserPort 구현 분리
 * </ul>
 *
 * <p>
 * 각 도메인별 LoadUserPort를 유지하는 이유:
 *
 * <ul>
 * <li>도메인 독립성: interview와 resume 도메인이 각자의 Port를 가짐
 * <li>서버 분리 대비: 각 서비스가 독립적으로 User 서비스를 호출 가능
 * <li>의존성 역전: Application Layer는 Port에만 의존, Adapter 구현은 교체 가능
 * </ul>
 */
@Component("resumePersistenceAdapter")
@RequiredArgsConstructor
public class ResumePersistenceAdapter
        implements LoadUserPort, SaveResumePort, LoadResumePort, LoadResumesByUserPort {

    private final UsersRepository usersRepository;
    private final ResumesRepository resumesRepository;

    @Override
    public Optional<User> loadUserById(UUID userId) {
        return usersRepository.findById(userId);
    }

    @Override
    public Optional<Resumes> loadResumeById(UUID resumeId) {
        return resumesRepository.findById(resumeId);
    }

    @Override
    public Resumes save(Resumes resume) {
        return resumesRepository.save(resume);
    }

    @Override
    public List<Resumes> loadResumesByUserId(UUID userId) {
        return resumesRepository.findByUser_Id(userId);
    }
}
