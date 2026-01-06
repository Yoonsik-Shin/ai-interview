package com.example.core.resume.adapter.out.persistence;

import java.util.Optional;

import org.springframework.stereotype.Component;

import com.example.core.domain.entity.Resumes;
import com.example.core.domain.entity.Users;
import com.example.core.domain.repository.ResumesRepository;
import com.example.core.domain.repository.UsersRepository;
import com.example.core.resume.application.port.out.LoadUserPort;
import com.example.core.resume.application.port.out.SaveResumePort;

import lombok.RequiredArgsConstructor;

/**
 * 이력서 Persistence Adapter
 * 
 * Output Adapter: Application Layer의 Port를 구현하여
 * JPA Repository를 래핑합니다.
 */
@Component
@RequiredArgsConstructor
public class ResumePersistenceAdapter implements LoadUserPort, SaveResumePort {

  private final UsersRepository usersRepository;
  private final ResumesRepository resumesRepository;

  @Override
  public Optional<Users> loadById(Long userId) {
    return usersRepository.findById(userId);
  }

  @Override
  public Resumes save(Resumes resume) {
    return resumesRepository.save(resume);
  }
}

