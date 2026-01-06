package com.example.core.domain.entity;

import java.time.LocalDateTime;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
// 🔥 핵심 변경점 1: 복합키 대신 유니크 제약조건으로 중복 방지
@Table(name = "user_skills", uniqueConstraints = { @UniqueConstraint(columnNames = { "user_id", "skill_id" }) })
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@EntityListeners(AuditingEntityListener.class)
public class UserSkills {

  // 🔥 핵심 변경점 2: 독립적인 대리키(PK) 사용
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "user_skill_id")
  private Long userSkillId;

  // 🔥 핵심 변경점 3: 평범한 비식별 ManyToOne 관계로 변경 (@MapsId 제거)
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private Users user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "skill_id", nullable = false)
  private Skills skill;

  @Column(name = "proficiency_level", nullable = false)
  private Integer proficiencyLevel;

  @CreatedDate
  @Column(name = "created_at", updatable = false)
  private LocalDateTime createdAt;

  // 생성자 (편의상 추가)
  private UserSkills(Users user, Skills skill, Integer proficiencyLevel) {
    this.user = user;
    this.skill = skill;
    this.proficiencyLevel = proficiencyLevel;
  }

  public static UserSkills create(Users user, Skills skill, Integer proficiencyLevel) {
    return new UserSkills(user, skill, proficiencyLevel);
  }

}
