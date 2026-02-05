package me.unbrdn.core.interview.domain.model;

/** LLM 스트리밍 응답 토큰 누적 관리 Domain Layer - 비즈니스 로직 */
public class TokenAccumulator {
    private final StringBuilder fullResponse = new StringBuilder();
    private final StringBuilder sentenceBuffer = new StringBuilder();
    private int sentenceIndex = 0;

    // State Tracking Flags
    private boolean endSignal = false;
    private boolean timeReduced = false;
    private boolean difficultyUpdated = false;
    private boolean lastInterviewerUpdated = false;

    public synchronized void appendToken(String token) {
        fullResponse.append(token);
        sentenceBuffer.append(token);
    }

    public synchronized String getCurrentSentence() {
        return sentenceBuffer.toString().trim();
    }

    public synchronized void clearSentence() {
        sentenceBuffer.setLength(0);
        sentenceIndex++;
    }

    public synchronized boolean hasSentence() {
        return sentenceBuffer.length() > 0;
    }

    public synchronized String getFullResponse() {
        return fullResponse.toString();
    }

    public synchronized int getSentenceIndex() {
        return sentenceIndex;
    }

    public synchronized boolean isEndSignal() {
        return endSignal;
    }

    public synchronized void setEndSignal(boolean endSignal) {
        this.endSignal = endSignal;
    }

    public synchronized boolean isTimeReduced() {
        return timeReduced;
    }

    public synchronized void setTimeReduced(boolean timeReduced) {
        this.timeReduced = timeReduced;
    }

    public synchronized boolean isDifficultyUpdated() {
        return difficultyUpdated;
    }

    public synchronized void setDifficultyUpdated(boolean difficultyUpdated) {
        this.difficultyUpdated = difficultyUpdated;
    }

    public synchronized boolean isLastInterviewerUpdated() {
        return lastInterviewerUpdated;
    }

    public synchronized void setLastInterviewerUpdated(boolean lastInterviewerUpdated) {
        this.lastInterviewerUpdated = lastInterviewerUpdated;
    }
}
