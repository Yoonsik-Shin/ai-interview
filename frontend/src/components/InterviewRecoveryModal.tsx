import { useNavigate } from "react-router-dom";
import { useInterviewRecovery } from "@/hooks/useInterviewRecovery";
import { client } from "@/api/client";
import styles from "./InterviewRecoveryModal.module.css";

/**
 * 세션 복구 모달 컴포넌트
 *
 * 이전에 진행하던 면접을 이어서 할 수 있도록 안내
 */
export function InterviewRecoveryModal() {
  const { showModal, recoveryData, dismissModal } = useInterviewRecovery();
  const navigate = useNavigate();

  const handleResume = async () => {
    if (!recoveryData) return;

    try {
      // PAUSED 상태인 경우 RESUME API 호출
      if (recoveryData.status === "PAUSED") {
        await client.post(`/v1/interviews/${recoveryData.interviewId}/resume`);
      }

      // 면접 페이지로 이동
      navigate(`/interview/${recoveryData.interviewId}`);
      dismissModal();
    } catch (error) {
      console.error("Resume failed:", error);
      alert("면접 재개에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleStartNew = () => {
    localStorage.removeItem("activeInterview");
    navigate("/setup");
    dismissModal();
  };

  const handleDismiss = () => {
    dismissModal();
  };

  if (!showModal || !recoveryData) return null;

  const formattedTime = new Date(recoveryData.timestamp).toLocaleString(
    "ko-KR",
    {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className={styles.title}>진행 중인 면접이 있습니다</h2>

        <p className={styles.description}>
          {formattedTime}에 시작한 면접을 이어서 진행하시겠습니까?
        </p>

        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.label}>상태</span>
            <span className={styles.value}>
              {recoveryData.status === "PAUSED" ? "일시 중지됨" : "진행 중"}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.label}>단계</span>
            <span className={styles.value}>{recoveryData.stage}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={handleResume} className={styles.primaryButton}>
            이어서 진행
          </button>
          <button onClick={handleStartNew} className={styles.secondaryButton}>
            새로운 면접 시작하기
          </button>
          <button onClick={handleDismiss} className={styles.ghostButton}>
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  );
}
