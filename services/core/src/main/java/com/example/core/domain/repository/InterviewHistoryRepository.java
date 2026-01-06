package com.example.core.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.core.domain.entity.InterviewHistory;

public interface InterviewHistoryRepository extends JpaRepository<InterviewHistory, Long> {
}