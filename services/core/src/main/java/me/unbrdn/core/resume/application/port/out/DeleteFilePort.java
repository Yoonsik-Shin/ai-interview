package me.unbrdn.core.resume.application.port.out;

/** 스토리지에서 파일을 삭제하는 Port */
public interface DeleteFilePort {
    void deleteFile(String filePath);
}
