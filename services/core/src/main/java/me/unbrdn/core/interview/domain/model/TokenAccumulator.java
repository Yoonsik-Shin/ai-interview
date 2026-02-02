package me.unbrdn.core.interview.domain.model;

/** LLM 스트리밍 응답 토큰 누적 관리 Domain Layer - 비즈니스 로직 */
public class TokenAccumulator {
    private final StringBuilder fullResponse = new StringBuilder();
    private final StringBuilder sentenceBuffer = new StringBuilder();
    private int sentenceIndex = 0;

    public void appendToken(String token) {
        fullResponse.append(token);
        sentenceBuffer.append(token);
    }

    public String getCurrentSentence() {
        return sentenceBuffer.toString().trim();
    }

    public void clearSentence() {
        sentenceBuffer.setLength(0);
        sentenceIndex++;
    }

    public boolean hasSentence() {
        return sentenceBuffer.length() > 0;
    }

    public String getFullResponse() {
        return fullResponse.toString();
    }

    public int getSentenceIndex() {
        return sentenceIndex;
    }
}
