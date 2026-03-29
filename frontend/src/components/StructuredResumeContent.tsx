// 이력서 섹션 헤더 키워드 (순서 중요: 긴 패턴 우선)
export const RESUME_SECTION_KEYWORDS = [
  '자격사항및어학능력교육사항병역사항자기소개서',
  '프로젝트 경험', '프로젝트경험',
  '학력사항', '경력사항', '기술스택', '기술 스택',
  '자격사항', '자기소개서', '병역사항',
  '수상경력', '어학능력', '교육사항', '활동사항', '인적사항',
  '이력서',
];

interface Props {
  content: string;
}

/**
 * A component to structure and render raw resume text with formatting.
 * Handles section headers and masks PII tokens.
 */
export function StructuredResumeContent({ content }: Props) {
  if (!content) return null;

  const pattern = new RegExp(
    `(${RESUME_SECTION_KEYWORDS.map((k) => k.replace(/\s/g, "\\s*")).join("|")})`,
    "g",
  );

  const segments: Array<{ isHeader: boolean; text: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(content)) !== null) {
    if (m.index > last) {
      segments.push({ isHeader: false, text: content.slice(last, m.index) });
    }
    segments.push({ isHeader: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    segments.push({ isHeader: false, text: content.slice(last) });
  }

  // 섹션 감지 실패 시 그냥 텍스트 렌더
  if (!segments.some((s) => s.isHeader)) {
    return (
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{content}</div>
    );
  }

  const renderBody = (text: string) => {
    const lines = text.split(/\n|(?<=[.!?。])\s+/).filter((l) => l.trim());
    return lines.map((line, i) => {
      // [Page X Image] 플레이스홀더
      if (/^\[Page \d+ Image\]/.test(line)) {
        return (
          <div
            key={i}
            style={{
              color: "#475569",
              fontStyle: "italic",
              fontSize: "0.78rem",
              margin: "0.25rem 0",
            }}
          >
            {line}
          </div>
        );
      }
      // PII 마스크 토큰 강조
      const parts = line.split(
        /(\[EMAIL\]|\[PHONE\]|\[DOB\]|\[ADDRESS\]|\[SSN\]|\[PASSPORT\]|\[DRIVER_LICENSE\])/g,
      );
      return (
          <div key={i} style={{ margin: "0.2rem 0" }}>
          {parts.map((part, j) =>
            /^\[.+\]$/.test(part) ? (
              <span
                key={j}
                style={{
                  background: "rgba(245,158,11,0.12)",
                  color: "#fbbf24",
                  borderRadius: "3px",
                  padding: "1px 4px",
                  fontSize: "0.85em",
                  fontFamily: "monospace",
                }}
              >
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </div>
      );
    });
  };

  return (
    <div style={{ fontSize: "0.875rem", lineHeight: 1.75, color: "#cbd5e1" }}>
      {segments.map((seg, i) =>
        seg.isHeader ? (
          <div
            key={i}
            style={{
              color: "#10b981",
              fontWeight: 700,
              fontSize: "0.75rem",
              marginTop: "1.5rem",
              marginBottom: "0.5rem",
              paddingBottom: "0.3rem",
              borderBottom: "1px solid rgba(16,185,129,0.25)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {seg.text}
          </div>
        ) : (
          <div key={i}>{renderBody(seg.text)}</div>
        ),
      )}
    </div>
  );
}
