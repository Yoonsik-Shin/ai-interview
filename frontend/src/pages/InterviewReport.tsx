import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createReport, getReport, getRecordingSegments, GetReportRes, RecordingSegment } from "../api/interview";
import styles from "./InterviewReport.module.css";

const POLL_INTERVAL_MS = 3000;

export function InterviewReport() {
  const { interviewId, reportId: reportIdParam } = useParams<{
    interviewId: string;
    reportId: string;
  }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<GetReportRes | null>(null);
  const [_reportId, setReportId] = useState<string | null>(reportIdParam ?? null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [segments, setSegments] = useState<RecordingSegment[]>([]);
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchReport = async (id: string) => {
    try {
      const res = await getReport(interviewId!, id);
      setReport(res);
      if (res.generationStatus !== "PENDING") {
        stopPolling();
      }
    } catch (e) {
      setError("리포트를 불러오는 중 오류가 발생했습니다.");
      stopPolling();
    }
  };

  useEffect(() => {
    if (!interviewId) return;

    const init = async () => {
      try {
        let id = reportIdParam;
        if (!id) {
          const res = await createReport(interviewId);
          id = res.reportId ?? undefined;
          setReportId(id ?? null);
          // URL을 리포트 ID 포함한 주소로 교체 (히스토리에 남기지 않음)
          window.history.replaceState(
            null,
            "",
            `/interviews/${interviewId}/reports/${id}`,
          );
        }

        if (!id) return;
        await fetchReport(id);

        // PENDING이면 폴링 시작
        pollRef.current = setInterval(() => {
          fetchReport(id!);
        }, POLL_INTERVAL_MS);
      } catch (e) {
        setError("리포트 생성 요청에 실패했습니다.");
      }
    };

    init();
    return () => stopPolling();
  }, [interviewId]);

  // 폴링 중 COMPLETED/FAILED 감지 시 자동 중단
  useEffect(() => {
    if (report && report.generationStatus !== "PENDING") {
      stopPolling();
    }
  }, [report]);

  // 리포트 COMPLETED 시 영상 세그먼트 로드
  useEffect(() => {
    if (report?.generationStatus !== "COMPLETED" || !interviewId) return;
    getRecordingSegments(interviewId)
      .then((segs) => {
        setSegments(segs);
        if (segs.length > 0) setSelectedTurn(segs[0].turnCount);
      })
      .catch(() => { /* 영상 없이 리포트는 정상 표시 */ });
  }, [report?.generationStatus, interviewId]);

  const handleVideoError = async () => {
    if (!interviewId) return;
    try {
      const fresh = await getRecordingSegments(interviewId);
      setSegments(fresh);
    } catch { /* ignore */ }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return styles.scorePass;
    if (score >= 50) return styles.scoreHold;
    return styles.scoreFail;
  };

  const passLabel = (status: string) => {
    if (status === "PASS") return { label: "합격", className: styles.badgePass };
    if (status === "FAIL") return { label: "불합격", className: styles.badgeFail };
    return { label: "보류", className: styles.badgeHold };
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link to="/interviews" className={styles.backButton}>
          ← 면접 내역으로
        </Link>
        <h1 className={styles.headerTitle}>면접 리포트</h1>
      </header>

      <main className={styles.content}>
        {error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button className={styles.backBtn} onClick={() => navigate("/interviews")}>
              면접 내역으로 돌아가기
            </button>
          </div>
        ) : !report || report.generationStatus === "PENDING" ? (
          <div className={styles.pendingState}>
            <div className={styles.spinner} />
            <p className={styles.pendingText}>리포트를 생성하고 있습니다...</p>
            <p className={styles.pendingSubText}>면접 내용을 분석 중입니다. 잠시만 기다려 주세요.</p>
            <button
              className={styles.laterBtn}
              onClick={() => navigate("/interviews")}
            >
              나중에 보기
            </button>
          </div>
        ) : report.generationStatus === "FAILED" ? (
          <div className={styles.errorState}>
            <p>리포트 생성에 실패했습니다.</p>
            <button className={styles.backBtn} onClick={() => navigate("/interviews")}>
              면접 내역으로 돌아가기
            </button>
          </div>
        ) : (
          <div className={styles.reportContent}>
            {/* 점수 카드 */}
            <div className={styles.scoreCard}>
              <div className={`${styles.scoreCircle} ${scoreColor(report.totalScore)}`}>
                <span className={styles.scoreNumber}>{report.totalScore}</span>
                <span className={styles.scoreLabel}>/ 100</span>
              </div>
              <div
                className={`${styles.passBadge} ${passLabel(report.passFailStatus).className}`}
              >
                {passLabel(report.passFailStatus).label}
              </div>
            </div>

            {/* 종합 평가 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>종합 평가</h2>
              <p className={styles.sectionText}>{report.summaryText}</p>
            </section>

            {/* 이력서 피드백 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>이력서 기반 피드백</h2>
              <p className={styles.sectionText}>{report.resumeFeedback}</p>
            </section>

            {/* 영상 다시 보기 */}
            {segments.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>영상 다시 보기</h2>

                <div className={styles.turnSelector}>
                  {segments
                    .sort((a, b) => a.turnCount - b.turnCount)
                    .map((seg, index) => (
                      <button
                        key={seg.turnCount}
                        className={`${styles.turnBtn} ${selectedTurn === seg.turnCount ? styles.turnBtnActive : ""}`}
                        onClick={() => setSelectedTurn(seg.turnCount)}
                      >
                        턴 {index + 1}
                      </button>
                    ))}
                </div>

                {selectedTurn !== null && (() => {
                  const seg = segments.find((s) => s.turnCount === selectedTurn);
                  if (!seg) return null;
                  return (
                    <div className={styles.turnDetail}>
                      <div className={styles.videoSection}>
                        <video
                          key={seg.recordingUrl}
                          className={styles.videoPlayer}
                          src={seg.recordingUrl}
                          controls
                          onError={handleVideoError}
                        />
                      </div>
                      <div className={styles.qaSection}>
                        <div className={styles.qaItem}>
                          <div className={styles.roleLabel}>면접관 질문</div>
                          <p className={styles.qaContent}>{seg.questionContent || "질문 정보가 없습니다."}</p>
                          {seg.questionAudioUrl && (
                            <div className={styles.audioWrap}>
                              <span className={styles.audioLabel}>질문 음성</span>
                              <audio src={seg.questionAudioUrl} controls className={styles.audioPlayer} />
                            </div>
                          )}
                        </div>
                        <div className={styles.qaItem}>
                          <div className={styles.roleLabel}>지원자 답변</div>
                          <p className={styles.qaContent}>{seg.answerContent || "답변 정보가 없습니다."}</p>
                          {seg.answerAudioUrl && (
                            <div className={styles.audioWrap}>
                              <span className={styles.audioLabel}>답변 음성</span>
                              <audio src={seg.answerAudioUrl} controls className={styles.audioPlayer} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className={styles.turnNav}>
                  <button
                    className={styles.navBtn}
                    disabled={selectedTurn === segments[0]?.turnCount}
                    onClick={() => {
                      const idx = segments.findIndex((s) => s.turnCount === selectedTurn);
                      if (idx > 0) setSelectedTurn(segments[idx - 1].turnCount);
                    }}
                  >
                    ← 이전 턴
                  </button>
                  <button
                    className={styles.navBtn}
                    disabled={selectedTurn === segments[segments.length - 1]?.turnCount}
                    onClick={() => {
                      const idx = segments.findIndex((s) => s.turnCount === selectedTurn);
                      if (idx < segments.length - 1) setSelectedTurn(segments[idx + 1].turnCount);
                    }}
                  >
                    다음 턴 →
                  </button>
                </div>
              </section>
            )}

            <button
              className={styles.backBtn}
              onClick={() => navigate("/interviews")}
            >
              면접 내역으로 돌아가기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
