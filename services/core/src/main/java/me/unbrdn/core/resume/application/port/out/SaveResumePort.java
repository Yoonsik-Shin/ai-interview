package me.unbrdn.core.resume.application.port.out;

import me.unbrdn.core.domain.entity.Resumes;

/**
 * 이력서 저장 Output Port
 */
public interface SaveResumePort {

  Resumes save(Resumes resume);
}

