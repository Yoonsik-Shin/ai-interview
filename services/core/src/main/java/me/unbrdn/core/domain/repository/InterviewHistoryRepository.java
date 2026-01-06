package me.unbrdn.core.domain.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import me.unbrdn.core.domain.entity.InterviewHistory;

public interface InterviewHistoryRepository extends JpaRepository<InterviewHistory, Long> {
}