package me.unbrdn.core.resume.domain.service;

/**
 * 문서 파싱 도메인 서비스 인터페이스
 * 
 * PDF, Word 등의 문서에서 텍스트를 추출하는 기능을 추상화합니다.
 */
public interface DocumentParser {

  /**
   * 문서 파일에서 텍스트를 추출합니다.
   * 
   * @param fileData 파일 바이너리 데이터
   * @param contentType MIME 타입 (예: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document)
   * @return 추출된 텍스트
   * @throws DocumentParseException 파싱 실패 시
   */
  String extractText(byte[] fileData, String contentType) throws DocumentParseException;
}

