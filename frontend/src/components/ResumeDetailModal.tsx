import { useEffect, useState } from "react";
import { getResume, type ResumeDetail } from "@/api/resumes";
import { Portal } from "./Portal";
import { PremiumResumeViewer } from "./PremiumResumeViewer";
import { StructuredResumeContent } from "./StructuredResumeContent";
import { formatDate } from "@/utils/date";
import styles from "./ResumeDetailModal.module.css";

interface Props {
  resumeId: string;
  onClose: () => void;
}

/**
 * A shared modal component for displaying detailed resume information.
 * Features: Metadata bar, Download link, PDF viewer, and Extracted text toggle.
 * Uses React Portal to avoid CSS z-index/transform issues.
 */
export function ResumeDetailModal({ resumeId, onClose }: Props) {
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDetail() {
      try {
        setLoading(true);
        const data = await getResume(resumeId);
        setDetail(data.resume);
      } catch (e) {
        setError(e instanceof Error ? e.message : "이력서를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [resumeId]);

  // Lock body scroll when open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const statusClass = (status: string) =>
    styles[`status${status}` as keyof typeof styles] || styles.statusPENDING;

  return (
    <Portal>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>
              {loading ? "로딩 중…" : detail?.title || "이력서 상세 보기"}
            </h2>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>

          {!loading && detail && (
            <>
              <div className={styles.modalMetaBar}>
                <div className={styles.metaLeft}>
                  <span className={styles.date}>{formatDate(detail.createdAt)}</span>
                  <span className={styles.divider}>·</span>
                  <span className={statusClass(detail.status)}>{detail.status}</span>
                </div>
                {detail.fileUrl && (
                  <a
                    href={detail.fileUrl}
                    download
                    className={styles.downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📥 원본 다운로드
                  </a>
                )}
              </div>

              <div className={styles.modalBody}>
                {detail.fileUrl && (
                  <div className={styles.viewerSection}>
                    <PremiumResumeViewer fileUrl={detail.fileUrl} />
                  </div>
                )}

                <div className={styles.extractedSection}>
                  <button
                    className={styles.toggleTextButton}
                    onClick={() => setIsTextExpanded(!isTextExpanded)}
                  >
                    {isTextExpanded ? "📂 추출 텍스트 접기" : "📖 추출 텍스트 보기"}
                  </button>

                  <div className={`${styles.textContent} ${isTextExpanded ? styles.expanded : ""}`}>
                    {detail.content ? (
                      <StructuredResumeContent content={detail.content} />
                    ) : (
                      <div className={styles.noContent}>
                        파싱된 내용이 없습니다. 아직 처리 중이거나 지원 형식이 아닐 수 있습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      </div>
    </Portal>
  );
}
