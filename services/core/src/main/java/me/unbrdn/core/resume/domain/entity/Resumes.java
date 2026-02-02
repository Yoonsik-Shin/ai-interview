package me.unbrdn.core.resume.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.common.domain.BaseTimeEntity;
import me.unbrdn.core.user.domain.entity.User;

@Entity
@Table(name = "resumes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Resumes extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String title;

    @Lob // 긴 텍스트 (TEXT 타입 매핑)
    @Column(nullable = false)
    private String content;

    private Resumes(User user, String title, String content) {
        this.user = user;
        this.title = title;
        this.content = content;
    }

    public static Resumes create(User user, String title, String content) {
        return new Resumes(user, title, content);
    }
}
