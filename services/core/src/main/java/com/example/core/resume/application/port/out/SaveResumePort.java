package com.example.core.resume.application.port.out;

import com.example.core.domain.entity.Resumes;

/**
 * 이력서 저장 Output Port
 */
public interface SaveResumePort {

  Resumes save(Resumes resume);
}

