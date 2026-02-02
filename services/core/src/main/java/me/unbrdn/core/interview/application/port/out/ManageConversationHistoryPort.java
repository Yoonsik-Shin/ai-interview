package me.unbrdn.core.interview.application.port.out;

import java.util.List;
import me.unbrdn.core.interview.domain.model.ConversationHistory;

/** 대화 히스토리를 Redis에서 관리하기 위한 Port */
public interface ManageConversationHistoryPort {
    List<ConversationHistory> loadHistory(String interviewId);

    void appendExchange(String interviewId, String userText, String aiAnswer);
}
