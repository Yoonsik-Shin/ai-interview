package me.unbrdn.core.interview.adapter.out.mongodb;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.unbrdn.core.interview.adapter.out.mongodb.entity.InterviewMessageDocument;
import me.unbrdn.core.interview.adapter.out.mongodb.repository.InterviewMessageRepository;
import me.unbrdn.core.interview.application.port.out.LoadInterviewHistoryPort;
import org.springframework.stereotype.Component;

/** MongoDB Adapter for loading interview history */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoHistoryAdapter implements LoadInterviewHistoryPort {

    private final InterviewMessageRepository repository;

    @Override
    public List<InterviewMessageDocument> loadHistory(String interviewId) {
        log.info("Loading interview history from MongoDB: interviewId={}", interviewId);
        return repository.findByInterviewIdOrderByTimestampAsc(interviewId);
    }
}
