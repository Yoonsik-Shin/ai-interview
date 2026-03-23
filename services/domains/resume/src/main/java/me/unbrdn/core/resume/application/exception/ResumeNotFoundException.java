package me.unbrdn.core.resume.application.exception;

/** 이력서를 찾을 수 없을 때 발생하는 예외 */
public class ResumeNotFoundException extends RuntimeException {
    public ResumeNotFoundException(String message) {
        super(message);
    }
}
