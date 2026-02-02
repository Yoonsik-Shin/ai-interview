package me.unbrdn.core.user.adapter.out.persistence;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.user.application.port.out.UserPort;
import me.unbrdn.core.user.domain.entity.User;
import me.unbrdn.core.user.domain.repository.UsersRepository;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserPersistenceAdapter implements UserPort {

    private final UsersRepository usersRepository;

    @Override
    public Optional<User> loadByEmail(String email) {
        return usersRepository.findByEmail(email);
    }

    @Override
    public Optional<User> loadById(UUID userId) {
        return usersRepository.findById(userId);
    }

    @Override
    public User save(User user) {
        return usersRepository.save(user);
    }
}
