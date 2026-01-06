package com.example.core.auth.adapter.out.persistence;

import java.util.Optional;

import org.springframework.stereotype.Component;

import com.example.core.auth.application.port.out.LoadUserPort;
import com.example.core.auth.application.port.out.SaveUserPort;
import com.example.core.domain.entity.Users;
import com.example.core.domain.repository.UsersRepository;

import lombok.RequiredArgsConstructor;

/**
 * 사용자 Persistence Adapter
 * 
 * Output Adapter: Application Layer의 Port를 구현하여
 * JPA Repository를 래핑합니다.
 */
@Component
@RequiredArgsConstructor
public class UserPersistenceAdapter implements LoadUserPort, SaveUserPort {

  private final UsersRepository usersRepository;

  @Override
  public Optional<Users> loadByEmail(String email) {
    return usersRepository.findByEmail(email);
  }

  @Override
  public Optional<Users> loadById(Long userId) {
    return usersRepository.findById(userId);
  }

  @Override
  public Users save(Users user) {
    return usersRepository.save(user);
  }
}

