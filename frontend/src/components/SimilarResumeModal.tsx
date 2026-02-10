import { useState } from "react";
import styles from "./SimilarResumeModal.module.css";

export interface SimilarResumeInfo {
  existingResumeId: string;
  similarity: number;
  title: string;
  uploadedAt: string;
}

interface SimilarResumeModalProps {
  similarResume: SimilarResumeInfo;
  onUpdate: () => void;
  onForceUpload: () => void;
  onCancel: () => void;
}

export function SimilarResumeModal({
  similarResume,
  onUpdate,
  onForceUpload,
  onCancel,
}: SimilarResumeModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 300);
  };

  const handleUpdate = () => {
    setIsClosing(true);
    setTimeout(() => {
      onUpdate();
    }, 300);
  };

  const handleForceUpload = () => {
    setIsClosing(true);
    setTimeout(() => {
      onForceUpload();
    }, 300);
  };

  const similarityPercent = (similarResume.similarity * 100).toFixed(1);

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}>
      <div className={`${styles.modal} ${isClosing ? styles.closing : ""}`}>
        <div className={styles.header}>
          <h2>유사한 이력서가 존재합니다</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.warningIcon}>⚠️</div>
          <p className={styles.message}>
            기존 이력서 <strong>"{similarResume.title}"</strong>와{" "}
            <strong className={styles.similarity}>{similarityPercent}%</strong>{" "}
            유사합니다.
          </p>
          <p className={styles.subMessage}>어떻게 처리하시겠습니까?</p>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.updateButton}`}
            onClick={handleUpdate}
          >
            기존 이력서 업데이트
          </button>
          <button
            className={`${styles.button} ${styles.forceButton}`}
            onClick={handleForceUpload}
          >
            새 이력서로 등록
          </button>
          <button
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={handleClose}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
