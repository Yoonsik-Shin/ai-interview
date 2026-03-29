package me.unbrdn.core.user.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.user.adapter.out.persistence.repository.UserJpaRepository;
import me.unbrdn.core.user.application.port.out.UserPort;
import me.unbrdn.core.user.domain.entity.User;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class UserPersistenceAdapter implements UserPort {

    private final UserJpaRepository usersRepository;
    private final UserMapper userMapper;

    @Override
    @Transactional(readOnly = true)
    public Optional<User> loadByEmail(String email) {
        return usersRepository.findByEmail(email).map(userMapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<User> loadByNickname(String nickname) {
        return usersRepository.findByNickname(nickname).map(userMapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<User> loadById(UUID userId) {
        return usersRepository.findById(userId).map(userMapper::toDomain);
    }

    @Override
    @Transactional
    public User save(User user) {
        return userMapper.toDomain(usersRepository.save(userMapper.toJpaEntity(user)));
    }
}
