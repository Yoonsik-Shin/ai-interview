package me.unbrdn.core.domain.entity;

import java.time.LocalDateTime;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import me.unbrdn.core.domain.enums.UserRole;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class Users {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "user_id")
  private Long userId;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(nullable = false, length = 50)
  private String nickname;

  @Column(name = "\"password\"", length = 255)
  private String password;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private UserRole role;

  @CreatedDate
  @Column(name = "created_at", updatable = false)
  private LocalDateTime createdAt;

  private Users(String email, String nickname, UserRole role) {
    this.email = email;
    this.nickname = nickname;
    this.role = role;
  }

  private Users(String email, String nickname, String password, UserRole role) {
    this.email = email;
    this.nickname = nickname;
    this.password = password;
    this.role = role;
  }

  public static Users create(String email, String nickname, UserRole role) {
    return new Users(email, nickname, role);
  }

  public static Users create(String email, String nickname) {
    return new Users(email, nickname, UserRole.INTERVIEWEE);
  }

  public static Users createWithPassword(String email, String nickname, String password, UserRole role) {
    return new Users(email, nickname, password, role);
  }

  public void changePassword(String encodedPassword) {
    this.password = encodedPassword;
  }

  /**
   * 인코딩된 비밀번호를 반환합니다. 비밀번호 검증은 Application Layer에서 PasswordEncoder를 통해 수행합니다.
   * 
   * @return 인코딩된 비밀번호 (없으면 null)
   */
  public String getEncodedPassword() {
    return this.password;
  }
}
