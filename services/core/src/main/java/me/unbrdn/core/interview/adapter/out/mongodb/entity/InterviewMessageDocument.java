package me.unbrdn.core.interview.adapter.out.mongodb.entity;

import java.time.Instant;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * MongoDB Document for interview message history
 *
 * <p>Stored in MongoDB for audit trail and query optimization
 */
@Document(collection = "interview_messages")
@CompoundIndex(
        name = "unique_message_idx",
        def = "{'interview_id': 1, 'timestamp': 1, 'role': 1}",
        unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewMessageDocument {

    @Id private String id;

    @Field("interview_id")
    private String interviewId;

    @Field("timestamp")
    private Instant timestamp;

    @Field("role")
    private String role; // USER, ASSISTANT, SYSTEM

    @Field("type")
    private String type; // TEXT, EVENT, etc.

    @Field("content")
    private String content;

    @Field("payload")
    private Map<String, String> payload;
}
