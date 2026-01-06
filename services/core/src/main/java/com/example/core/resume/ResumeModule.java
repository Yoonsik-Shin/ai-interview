package com.example.core.resume;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * Resume 모듈 Configuration
 * 
 * Resume 도메인 관련 빈들을 스캔하여 등록합니다.
 */
@Configuration
@ComponentScan(basePackages = "com.example.core.resume")
public class ResumeModule {
  // Spring의 ComponentScan을 통해 자동으로 빈 등록됨
}

