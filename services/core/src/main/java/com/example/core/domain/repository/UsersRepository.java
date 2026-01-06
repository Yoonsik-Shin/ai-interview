package com.example.core.domain.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.Users;

public interface UsersRepository extends JpaRepository<Users, Long> {
  // 이메일로 사용자 조회 (로그인 시 필요)
  Optional<Users> findByEmail(String email);
}