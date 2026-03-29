package me.unbrdn.core.interview.application.port.out;

/** Redis Cache에 토큰을 Append하기 위한 Port */
public interface AppendRedisCachePort {
    void appendToken(String interviewId, String token, String persona);

    void appendSentenceBuffer(String interviewId, String token, String persona);

    String getAndClearSentenceBuffer(String interviewId, String persona);

    void appendFullResponseBuffer(String interviewId, String token, String persona);

    String getAndClearFullResponseBuffer(String interviewId, String persona);
}
