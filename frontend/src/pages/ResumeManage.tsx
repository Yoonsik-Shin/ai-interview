import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  listResumes,
  deleteResume,
  retryResumeProcessing,
  type ResumeItem,
} from "@/api/resumes";
import type { ValidationResult } from "@/services/resume-validator";
import { Toast } from "@/components/Toast";
import { ResumeUploadZone } from "@/components/ResumeUploadZone";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ResumeDetailModal } from "@/components/ResumeDetailModal";
import { formatDate } from "@/utils/date";
import styles from "./ResumeManage.module.css";


export function ResumeManage() {
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedResumeIdForDetail, setSelectedResumeIdForDetail] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchResumes = useCallback(async () => {
    try {
      setError("");
      const data = await listResumes();
      setResumes(data.resumes);
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

  const handleViewDetail = (id: string) => {
    setSelectedResumeIdForDetail(id);
  };

  const closeDetail = () => {
    setSelectedResumeIdForDetail(null);
    fetchResumes(); // 목록 갱신 (상태 동기화)
  };

  const handleRetry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await retryResumeProcessing(id);
      setSuccess("이력서 재처리가 요청되었습니다. 잠시 후 새로고침해주세요.");
      await fetchResumes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "재처리 요청에 실패했습니다.");
    }
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {r.status === "FAILED" && (
                      <button
                        className={styles.retryButton}
                        onClick={(e) => handleRetry(e, r.id)}
                        title="처리 실패 — 재시도"
                      >
                        재처리
                      </button>
                    )}
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

      {selectedResumeIdForDetail && (
        <ResumeDetailModal
          resumeId={selectedResumeIdForDetail}
          onClose={closeDetail}
        />
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
