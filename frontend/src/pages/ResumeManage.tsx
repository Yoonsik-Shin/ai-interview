import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  listResumes,
  getResume,
  deleteResume,
  type ResumeItem,
  type ResumeDetail,
} from "@/api/resumes";
import type { ValidationResult } from "@/services/resume-validator";
import { Toast } from "@/components/Toast";
import { ResumeUploadZone } from "@/components/ResumeUploadZone";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PremiumResumeViewer } from "@/components/PremiumResumeViewer";
import styles from "./ResumeManage.module.css";

function formatDate(iso: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ResumeManage() {
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  const fetchResumes = useCallback(async () => {
    try {
      setError("");
      const data = await listResumes();
      setResumes(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "이력서 목록을 불러올 수 없습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const [_validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      setValidationResult(null);
      setError("");
    }
    // Note: Validation is triggered by ResumeUploadZone
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getResume(id);
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setIsTextExpanded(false);
    fetchResumes(); // 목록 갱신 (상태 동기화)
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleteModalOpen(false);

    try {
      await deleteResume(deleteId);
      setSuccess("이력서가 삭제되었습니다.");
      await fetchResumes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleteId(null);
    }
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeleteId(null);
  };

  const statusClass = (status: string) =>
    styles[`status${status}` as keyof typeof styles] || styles.statusPENDING;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link to="/" className={styles.backButton}>
          ← 뒤로
        </Link>
        <h1 className={styles.headerTitle}>이력서 관리</h1>
      </header>

      <main className={styles.content}>
        <section className={styles.uploadSection}>
          <h2>이력서 업로드</h2>
          <ResumeUploadZone
            selectedFile={selectedFile}
            validationResult={validationResult}
            onFileSelect={handleFileSelect}
            onAnalyzeStart={() => setValidating(true)}
            onAnalyzeEnd={(result) => {
              setValidating(false);
              setValidationResult(result);
            }}
            onError={setError}
            enableUpload={true}
            onUploadComplete={async (_resumeId) => {
              setSuccess("이력서가 성공적으로 업로드되었습니다.");
              await fetchResumes();
              setSelectedFile(null);
              setValidationResult(null);
            }}
            existingResumes={resumes}
          />
        </section>

        <section className={styles.listSection}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h2 style={{ margin: 0 }}>내 이력서 목록</h2>
            <button
              onClick={fetchResumes}
              className={styles.refreshButton}
              title="목록 새로고침"
            >
              <span className={styles.refreshIcon}>🔄</span>
              <span>목록 새로고침</span>
            </button>
          </div>
          {loading ? (
            <div className={styles.emptyState}>로딩 중…</div>
          ) : resumes.length === 0 ? (
            <div className={styles.emptyState}>
              등록된 이력서가 없습니다. 위에서 이력서를 업로드해주세요.
            </div>
          ) : (
            <div className={styles.resumeList}>
              {resumes.map((r: ResumeItem) => (
                <div
                  key={r.id}
                  className={styles.resumeCard}
                  onClick={() => handleViewDetail(r.id)}
                >
                  <div className={styles.resumeCardInfo}>
                    <div className={styles.resumeCardTitle}>{r.title}</div>
                    <div className={styles.resumeCardMeta}>
                      {formatDate(r.createdAt)} ·{" "}
                      <span className={statusClass(r.status)}>{r.status}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <button
                      className={styles.deleteButton}
                      onClick={(e) => handleDelete(e, r.id)}
                    >
                      삭제
                    </button>
                    <span style={{ color: "#94a3b8", marginLeft: "1rem" }}>
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {detailLoading && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>로딩 중…</span>
            </div>
          </div>
        </div>
      )}

      {detail && !detailLoading && (
        <div className={styles.modalOverlay} onClick={closeDetail}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{detail.title}</h2>
              <button className={styles.modalClose} onClick={closeDetail}>
                ✕
              </button>
            </div>

            <div className={styles.modalMetaBar}>
              <div>
                {formatDate(detail.createdAt)} ·{" "}
                <span className={statusClass(detail.status)}>
                  {detail.status}
                </span>
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
                  {isTextExpanded
                    ? "📂 추출 텍스트 접기"
                    : "📖 추출 텍스트 보기"}
                </button>

                {isTextExpanded && (
                  <div className={styles.modalContent}>
                    {detail.content ||
                      "파싱된 내용이 없습니다. 아직 처리 중이거나 지원 형식이 아닐 수 있습니다."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError("")}
          autoDismissMs={5000}
        />
      )}

      {success && (
        <Toast
          message={success}
          type="success"
          onClose={() => setSuccess("")}
          autoDismissMs={3000}
        />
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="이력서 삭제"
        message="정말 이 이력서를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다."
        confirmText="삭제"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
