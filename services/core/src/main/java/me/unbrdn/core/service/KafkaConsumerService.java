package me.unbrdn.core.service;

import java.util.Map;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import me.unbrdn.core.domain.entity.InterviewHistory;
import me.unbrdn.core.domain.repository.InterviewHistoryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class KafkaConsumerService {

  private final InterviewHistoryRepository interviewHistoryRepository;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @KafkaListener(topics = "interview-result", groupId = "core-group-v2")
  public void listen(String message) {
    try {
      System.out.println("💾 [DB Save Start] " + message);

      // 1. JSON 문자열 -> Map으로 변환
      Map<String, String> map = objectMapper.readValue(message, new TypeReference<Map<String, String>>() {
      });

      // 2. Entity 생성
      InterviewHistory interviewHistory = InterviewHistory.create("User1", // 나중에 로그인 붙이면 실제 ID로 변경
          map.get("userAnswer"), map.get("aiAnswer"));

      // 3. MySQL 저장
      interviewHistoryRepository.save(interviewHistory);
      System.out.println("✅ [DB Save Success] ID: " + interviewHistory.getId());
    } catch (Exception e) {
      System.err.println("❌ DB Save Error: " + e.getMessage());
    }
  }
}
