import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  listResumes,
  getResume,
  uploadResume,
  type ResumeItem,
  type ResumeDetail,
} from "@/api/resumes";
import { Toast } from "@/components/Toast";
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
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchResumes = useCallback(async () => {
    try {
      setError("");
      const data = await listResumes();
      setResumes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().split(".").pop();
      if (!["pdf", "doc", "docx"].includes(ext || "")) {
        setError("PDF, DOC, DOCX 파일만 업로드할 수 있습니다.");
        setSelectedFile(null);
        return;
      }
      setError("");
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    try {
      await uploadResume(selectedFile, selectedFile.name.replace(/\.[^.]+$/, ""));
      setSelectedFile(null);
      const input = document.getElementById("resume-file-input") as HTMLInputElement;
      if (input) input.value = "";
      await fetchResumes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
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
  };

  const statusClass =
    (status: string) =>
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
          <div
            className={styles.fileInputWrapper}
            onClick={() => document.getElementById("resume-file-input")?.click()}
          >
            <input
              id="resume-file-input"
              type="file"
              className={styles.fileInput}
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            <div className={styles.fileInputLabel}>
              <span>파일 선택</span> 또는 드래그 앤 드롭 (PDF, DOC, DOCX)
            </div>
            {selectedFile && (
              <div className={styles.fileName}>{selectedFile.name}</div>
            )}
          </div>
          <button
            className={styles.uploadButton}
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "업로드 중…" : "업로드"}
          </button>
        </section>

        <section className={styles.listSection}>
          <h2>내 이력서 목록</h2>
          {loading ? (
            <div className={styles.emptyState}>로딩 중…</div>
          ) : resumes.length === 0 ? (
            <div className={styles.emptyState}>
              등록된 이력서가 없습니다. 위에서 이력서를 업로드해주세요.
            </div>
          ) : (
            <div className={styles.resumeList}>
              {resumes.map((r) => (
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
                  <span style={{ color: "#94a3b8" }}>→</span>
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
            <div className={styles.modalBody}>
              <div className={styles.modalMeta}>
                {formatDate(detail.createdAt)} ·{" "}
                <span className={statusClass(detail.status)}>{detail.status}</span>
              </div>
              <div className={styles.modalContent}>
                {detail.content || "파싱된 내용이 없습니다. 아직 처리 중이거나 지원 형식이 아닐 수 있습니다."}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <Toast message={error} onClose={() => setError("")} autoDismissMs={5000} />
      )}
    </div>
  );
}
