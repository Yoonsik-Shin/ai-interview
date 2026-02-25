package me.unbrdn.core.interview.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.interview.application.port.out.LoadUserPort;
import me.unbrdn.core.user.adapter.out.persistence.UserMapper;
import me.unbrdn.core.user.adapter.out.persistence.repository.UserJpaRepository;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Component;

@Component("interviewUserPersistenceAdapter")
@RequiredArgsConstructor
public class UserPersistenceAdapter implements LoadUserPort {

    private final UserJpaRepository usersRepository;
    private final UserMapper userMapper;

    @Override
    public Optional<User> loadById(UUID userId) {
        return usersRepository.findById(userId).map(userMapper::toDomain);
    }
}
