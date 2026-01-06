package me.unbrdn.core.resume.domain.service;

/**
 * 문서 파싱 예외
 */
public class DocumentParseException extends RuntimeException {

  public DocumentParseException(String message) {
    super(message);
  }

  public DocumentParseException(String message, Throwable cause) {
    super(message, cause);
  }
}

