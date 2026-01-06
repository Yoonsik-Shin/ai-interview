package me.unbrdn.core.auth.application.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.unbrdn.core.auth.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.auth.application.port.in.RegisterUserUseCase;
import me.unbrdn.core.auth.application.port.out.LoadUserPort;
import me.unbrdn.core.auth.application.port.out.SaveUserPort;
import me.unbrdn.core.auth.domain.service.PasswordEncoder;
import me.unbrdn.core.domain.entity.Users;
import me.unbrdn.core.domain.enums.UserRole;

import lombok.RequiredArgsConstructor;

/**
 * 회원가입 UseCase 구현체 (Interactor)
 * 
 * 비즈니스 로직:
 * 1. 이메일 중복 체크
 * 2. 비밀번호 해싱
 * 3. 사용자 저장
 */
@Service
@RequiredArgsConstructor
public class RegisterUserInteractor implements RegisterUserUseCase {

  private final LoadUserPort loadUserPort;
  private final SaveUserPort saveUserPort;
  private final PasswordEncoder passwordEncoder;

  @Override
  @Transactional
  public Long execute(RegisterUserCommand command) {
    // 1. 이메일 중복 체크
    if (loadUserPort.loadByEmail(command.getEmail()).isPresent()) {
      throw new UserAlreadyExistsException("이미 존재하는 이메일입니다: " + command.getEmail());
    }

    // 2. 비밀번호 해싱
    String encodedPassword = passwordEncoder.encode(command.getPassword());

    // 3. 사용자 생성 및 저장
    Users user = Users.createWithPassword(
        command.getEmail(),
        command.getNickname(),
        encodedPassword,
        UserRole.INTERVIEWEE
    );

    Users savedUser = saveUserPort.save(user);

    return savedUser.getUserId();
  }
}

