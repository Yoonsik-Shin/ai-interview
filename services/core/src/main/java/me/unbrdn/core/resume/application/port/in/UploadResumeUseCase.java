package me.unbrdn.core.resume.application.port.in;

import me.unbrdn.core.resume.application.service.UploadResumeCommand;

/**
 * 이력서 업로드 UseCase 인터페이스
 * 
 * Input Port: Application Layer에서 외부(Adapter)로 노출하는 인터페이스
 */
public interface UploadResumeUseCase {

  /**
   * 이력서 파일을 업로드하고 텍스트를 추출하여 저장합니다.
   * 
   * @param command 업로드 명령 (파일 데이터, 사용자 ID 등)
   * @return 생성된 이력서 ID
   */
  Long execute(UploadResumeCommand command);
}

