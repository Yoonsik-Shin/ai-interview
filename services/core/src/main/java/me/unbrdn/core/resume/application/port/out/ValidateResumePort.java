package me.unbrdn.core.resume.application.port.out;

import me.unbrdn.core.resume.application.dto.ValidateResumeResult;

/** 이력서 판별을 위한 Outbound Port */
public interface ValidateResumePort {
    ValidateResumeResult validateResume(String text);
}
