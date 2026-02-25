package me.unbrdn.core.interview.adapter.out.mongodb.repository;

import java.util.List;
import me.unbrdn.core.interview.adapter.out.mongodb.entity.InterviewMessageDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/** MongoDB Repository for interview message history */
@Repository
public interface InterviewMessageRepository
        extends MongoRepository<InterviewMessageDocument, String> {

    /**
     * Find all messages for a specific interview, ordered by timestamp ascending
     *
     * @param interviewId the interview ID
     * @return list of messages in chronological order
     */
    List<InterviewMessageDocument> findByInterviewIdOrderByTimestampAsc(String interviewId);
}
