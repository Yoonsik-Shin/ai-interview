package me.unbrdn.core.interview.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import me.unbrdn.core.common.domain.BaseTimeEntity;

@Entity
@Getter // 1. Getter만 열기 (Setter는 닫기)
@NoArgsConstructor(access = AccessLevel.PROTECTED) // 2. JPA용 기본 생성자 (외부에서 함부로 생성 못하게 PROTECTED 권장)
@ToString // 3. 연관관계 생기면 (exclude = "...") 추가 필요
@Table(name = "interview_history")
public class InterviewHistory extends BaseTimeEntity {

    private String userName; // 사용자 이름 (일단 하드코딩)

    @Lob
    @Column(name = "user_question")
    private String userQuestion; // 사용자 답변 (자바 GC는...)

    @Lob
    @Column(name = "ai_response")
    private String aiResponse; // AI 질문 (그렇다면 STW는...)

    // 2. 실제 데이터를 넣는 생성자도 'private'으로 완전히 숨긴다.
    // 이 클래스 내부에서만 호출할 수 있습니다.
    private InterviewHistory(String userName, String userQuestion, String aiResponse) {

        // (필요하다면 여기에 유효성 검증 로직 추가 가능. 예: userName이 비어있으면 안 된다 등)
        this.userName = userName;
        this.userQuestion = userQuestion;
        this.aiResponse = aiResponse;
    }

    // 3. 외부에는 이 '정적 팩토리 메서드'만 공개한다. (유일한 생성 통로)
    // 이름은 보통 create, of, from 등을 사용합니다.
    public static InterviewHistory create(String userName, String userQuestion, String aiResponse) {
        // 이곳이 객체 생성의 유일한 관문이 됩니다.
        return new InterviewHistory(userName, userQuestion, aiResponse);
    }

    // 1. 메모리 주소가 달라도,
    // 2. 프록시 객체여도,
    // 3. ID(PK)만 같으면 "같은 데이터"로 취급하겠다.
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof InterviewHistory that)) return false;
        return id != null && Objects.equals(id, that.id);
    }

    // 필드 값이 변경되어도 해시코드가 바뀌지 않도록 고정값 반환
    @Override
    public int hashCode() {
        return Objects.hash(getClass());
    }
}
