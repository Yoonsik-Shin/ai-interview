package me.unbrdn.core.resume.adapter.out.persistence;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.springframework.stereotype.Component;

import me.unbrdn.core.resume.domain.service.DocumentParseException;
import me.unbrdn.core.resume.domain.service.DocumentParser;

import lombok.extern.slf4j.Slf4j;

/**
 * Apache Tika를 사용한 문서 파서 구현체
 * 
 * Adapter 계층에서 외부 라이브러리(Apache Tika)를 사용하여
 * 도메인 인터페이스를 구현합니다.
 */
@Slf4j
@Component
public class TikaDocumentParser implements DocumentParser {

  private final Tika tika;

  public TikaDocumentParser() {
    this.tika = new Tika();
  }

  @Override
  public String extractText(byte[] fileData, String contentType) throws DocumentParseException {
    try {
      InputStream inputStream = new ByteArrayInputStream(fileData);
      String extractedText = tika.parseToString(inputStream);

      if (extractedText == null || extractedText.trim().isEmpty()) {
        throw new DocumentParseException("문서에서 텍스트를 추출할 수 없습니다.");
      }

      log.info("문서 파싱 완료: contentType={}, textLength={}", contentType, extractedText.length());
      return extractedText.trim();

    } catch (TikaException e) {
      log.error("Tika 파싱 오류", e);
      throw new DocumentParseException("문서 파싱 중 오류가 발생했습니다: " + e.getMessage(), e);
    } catch (Exception e) {
      log.error("문서 파싱 중 예상치 못한 오류", e);
      throw new DocumentParseException("문서 파싱 중 오류가 발생했습니다: " + e.getMessage(), e);
    }
  }
}

