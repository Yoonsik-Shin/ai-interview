package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.LoadUserPort;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.user.domain.repository.UsersRepository;
import org.springframework.stereotype.Component;

/**
 * Interview 도메인용 사용자 조회 Adapter
 *
 * <p>현재는 모놀리식 환경에서 같은 DB의 UsersRepository를 직접 접근합니다. 향후 서버 분리 시에는 이 Adapter를 UserGrpcAdapter로 교체하여
 * gRPC 클라이언트로 User 서비스를 호출합니다.
 *
 * <p>서버 분리 전략:
 *
 * <ul>
 *   <li>현재: UsersRepository 직접 접근 (같은 DB)
 *   <li>분리 후: UserGrpcAdapter로 교체 (gRPC 클라이언트)
 * </ul>
 *
 * <p>각 도메인별 LoadUserPort를 유지하는 이유:
 *
 * <ul>
 *   <li>도메인 독립성: interview와 resume 도메인이 각자의 Port를 가짐
 *   <li>서버 분리 대비: 각 서비스가 독립적으로 User 서비스를 호출 가능
 *   <li>의존성 역전: Application Layer는 Port에만 의존, Adapter 구현은 교체 가능
 * </ul>
 */
@Component("interviewUserPersistenceAdapter")
@RequiredArgsConstructor
public class UserPersistenceAdapter implements LoadUserPort {

    private final UsersRepository usersRepository;

    @Override
    public Optional<User> loadById(UUID userId) {
        return usersRepository.findById(userId);
    }
}
