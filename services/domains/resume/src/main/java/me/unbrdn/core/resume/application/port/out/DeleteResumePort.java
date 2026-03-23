package me.unbrdn.core.resume.application.port.out;

/** 이력서 삭제 Output Port (DB) */
public interface DeleteResumePort {
    void deleteById(String id);
}
