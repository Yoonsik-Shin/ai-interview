package com.example.core_java.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core_java.domain.entity.InterviewHistory;

public interface InterviewHistoryRepository extends JpaRepository<InterviewHistory, Long> {
}