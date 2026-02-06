import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

type ToastProps = {
  message: string;
  onClose: () => void;
  autoDismissMs?: number;
};

export function Toast({ message, onClose, autoDismissMs = 5000 }: ToastProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(onClose, 250);
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onClose]);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`${styles.toast} ${leaving ? styles.leaving : ""}`}
      role="alert"
    >
      <span className={styles.toastIcon} aria-hidden>
        ⚠
      </span>
      <span className={styles.toastContent}>{message}</span>
      <button
        type="button"
        className={styles.toastClose}
        onClick={handleClose}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  );
}
