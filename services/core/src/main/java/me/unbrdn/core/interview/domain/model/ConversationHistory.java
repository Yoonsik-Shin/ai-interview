package me.unbrdn.core.interview.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ConversationHistory {
    private String role; // "user", "assistant", or "system"
    private String content;
}
