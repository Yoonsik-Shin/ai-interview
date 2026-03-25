import { useNavigate, Link } from "react-router-dom";
import styles from "./Interviews.module.css";
import { useEffect, useState } from "react";
import {
  getInterviews,
  completeInterview,
  createReport,
  InterviewSessionSummary,
} from "../api/interview";
import { Skeleton } from "../components/Skeleton";
import { useInterviewRecovery } from "@/hooks/useInterviewRecovery";

export function Interviews() {
  const { triggerRecoveryCheck } = useInterviewRecovery();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInterviews = () => {
    setLoading(true);
    getInterviews()
      .then((res) => {
        setInterviews(res.interviews || []);
      })
      .catch((err) => console.error("Failed to fetch interviews", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleComplete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "정말 이 면접을 종료하겠습니까? 종료 후에는 더 이상 이어할 수 없습니다.",
      )
    ) {
      return;
    }

    try {
      await completeInterview(id);
      const reportRes = await createReport(id);
      navigate(`/interviews/${id}/reports/${reportRes.reportId}`);
    } catch (err) {
      console.error("Failed to complete interview", err);
      alert("면접 종료에 실패했습니다.");
    }
  };

  const handleViewReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const reportRes = await createReport(id);
      navigate(`/interviews/${id}/reports/${reportRes.reportId}`);
    } catch (err) {
      console.error("Failed to create report", err);
      alert("리포트를 불러오는 데 실패했습니다.");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link to="/" className={styles.backButton}>
          ← 홈으로
        </Link>
        <h1 className={styles.headerTitle}>면접 내역 확인</h1>
      </header>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.interviewList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.interviewCard}>
                <div className={styles.cardHeader}>
                  <Skeleton width={80} height={24} borderRadius={12} />
                  <Skeleton width={60} height={24} borderRadius={12} />
                </div>
                <div style={{ marginTop: "1rem" }}>
                  <Skeleton width={200} height={28} />
                </div>
                <div className={styles.cardMeta}>
                  <Skeleton width={120} height={16} />
                  <Skeleton width={100} height={16} />
                </div>
                <div className={styles.cardAction}>
                  <Skeleton width="100%" height={44} borderRadius={12} />
                </div>
              </div>
            ))}
          </div>
        ) : interviews.length > 0 ? (
          <div className={styles.interviewList}>
            {interviews.map((item) => (
              <div key={item.interviewId} className={styles.interviewCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.domainBadge}>{item.domain}</div>
                  <div
                    className={`${styles.statusBadge} ${
                      item.status === "COMPLETED"
                        ? styles.statusDone
                        : styles.statusActive
                    }`}
                  >
                    {item.status === "COMPLETED" ? "완료됨" : "진행 중"}
                  </div>
                </div>

                <h3 className={styles.cardTitle}>
                  {item.type === "REAL" ? "🚀 실전 면접" : "🛡️ 연습 면접"}
                </h3>

                <div className={styles.cardMeta}>
                  <span>🕒 {formatDate(item.startedAt)}</span>
                  <span>⏱️ 약 {item.scheduledDurationMinutes}분 소요</span>
                </div>

                <div className={styles.cardAction}>
                  {item.status !== "COMPLETED" && (
                    <button
                      className={`${styles.actionButton} ${styles.btnSecondary}`}
                      onClick={(e) => handleComplete(e, item.interviewId)}
                    >
                      종료하기
                    </button>
                  )}
                  {item.status === "COMPLETED" ? (
                    <button
                      className={styles.actionButton}
                      onClick={(e) => handleViewReport(e, item.interviewId)}
                    >
                      리포트 보기
                    </button>
                  ) : (
                    <button
                      className={styles.actionButton}
                      onClick={() => navigate(`/interview/${item.interviewId}`)}
                    >
                      이어하기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>기록된 면접 내역이 없습니다.</p>
            <button
              className={styles.startButton}
              onClick={async () => {
                const hasRecovery = await triggerRecoveryCheck();
                if (!hasRecovery) {
                  navigate("/setup");
                }
              }}
            >
              첫 면접 시작하기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
