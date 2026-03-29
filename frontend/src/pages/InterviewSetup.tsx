import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import {
  createInterview,
  type CreateInterviewReq,
  type InterviewPersona,
} from "@/api/interview";
import {
  listResumes,
  getResume,
  retryResumeProcessing,
  type ResumeItem,
  type ResumeDetail,
} from "@/api/resumes";
import { Toast } from "@/components/Toast";
import { ResumeUploadZone } from "@/components/ResumeUploadZone";
import { PremiumResumeViewer } from "@/components/PremiumResumeViewer";
import { Skeleton } from "@/components/Skeleton";
import { AudioTester } from "@/components/AudioTester";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
// import { useInterviewSocket } from "@/hooks/useInterviewSocket"; // Removed
import styles from "./InterviewSetup.module.css";

export function InterviewSetup() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedRoles, setSelectedRoles] = useState<InterviewPersona[]>([
    "LEADER",
    "TECH",
  ]);

  const [form, setForm] = useState<
    Omit<
      CreateInterviewReq,
      "resumeId" | "participatingPersonas" | "personality"
    >
  >({
    companyName: "",
    domain: "백엔드",
    round: "TECHNICAL",
    type: "REAL",
    scheduledDurationMinutes: 30,
    jobPostingUrl: "",
  });

  const getMandatoryPersonas = (round: string): InterviewPersona[] => {
    switch (round) {
      case "TECHNICAL":
        return ["LEADER", "TECH"];
      case "CULTURE_FIT":
        return ["LEADER", "HR"];
      case "EXECUTIVE":
        return ["EXEC"];
      default:
        return ["LEADER"];
    }
  };

  // [수정] 라운드 변경 시 면접관 자동 프리셋 로직 고도화
  useEffect(() => {
    setSelectedRoles(getMandatoryPersonas(form.round));
  }, [form.round]);

  // [수정] 필수 면접관은 토글되지 않도록 잠금 로직 추가
  const toggleRole = (role: InterviewPersona) => {
    const mandatory = getMandatoryPersonas(form.round);
    if (mandatory.includes(role)) return; // Locked

    setSelectedRoles((prev) => {
      const isSelected = prev.includes(role);
      if (isSelected) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const [existingResumes, setExistingResumes] = useState<ResumeItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [isNewUpload, setIsNewUpload] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);

  // 컨펌 모달 관련 상태
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasTestedAudio, setHasTestedAudio] = useState(false);
  const [checklist, setChecklist] = useState({
    media: false,
    ready: false,
    resumeRisk: false,
  });
  const [confirmResumeStatus, setConfirmResumeStatus] = useState<string | null>(
    null,
  );
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [retryingResumeId, setRetryingResumeId] = useState<string | null>(null);

  // 오디오 스트림 변경 시 테스트 상태 초기화
  // (useAudioRecorder 선언 뒤로 이동됨)

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setError("");
      setUploadedResumeId(null);
    }
  };

  // 이력서 목록 가져오기 함수 분리
  const loadResumes = async () => {
    setResumesLoading(true);
    try {
      const list = await listResumes();
      setExistingResumes(list.resumes);
      if (list.resumes.length === 0) {
        setIsNewUpload(true);
      } else {
        // 새로 업로드한 직후라면 해당 이력서가 선택되도록 로직 추가 가능
        // 기본적으로는 첫 번째 선택 유지
        if (!selectedResumeId) {
          setSelectedResumeId(list.resumes[0].id);
        }
      }
    } catch (err) {
      console.error("이력서 목록 로드 실패:", err);
    } finally {
      setResumesLoading(false);
    }
  };

  useEffect(() => {
    loadResumes();
  }, []);

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getResume(id);
      setDetail(data.resume);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
  };

  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  const {
    start: startAudio,
    stop: stopAudio,
    stream: audioStream,
  } = useAudioRecorder("setup", () => {}); // Empty callback

  // 오디오 스트림 변경 시 테스트 상태 초기화
  useEffect(() => {
    setHasTestedAudio(false);
  }, [audioStream]);

  const [mediaError, setMediaError] = useState("");
  const [devices, setDevices] = useState<{
    cameras: MediaDeviceInfo[];
    microphones: MediaDeviceInfo[];
  }>({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");

  // 미디어 권한 요청 및 스트림 가져오기
  useEffect(() => {
    isMountedRef.current = true;
    async function setupMedia() {
      try {
        // 미디어 권한 요청 (비디오 위주로 먼저)
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (!isMountedRef.current) {
          videoStream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        streamRef.current = videoStream;

        // 비디오 프리뷰 설정
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }

        // 오디오 레코더 시작 (기본 디바이스)
        const audioStream = await startAudio();

        // 디바이스 목록 가져오기
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (!isMountedRef.current) return;

        const cameras = deviceList.filter((d) => d.kind === "videoinput");
        const microphones = deviceList.filter((d) => d.kind === "audioinput");
        setDevices({ cameras, microphones });

        // 현재 사용 중인 비디오 디바이스 설정
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack)
          setSelectedCamera(videoTrack.getSettings().deviceId || "");

        // 현재 사용 중인 오디오 디바이스 설정
        if (audioStream) {
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            const trackId = audioTrack.getSettings().deviceId;
            // 만약 deviceId가 없으면(Default), 목록에서 'default' 혹은 첫 번째 마이크를 선택
            if (trackId) {
              setSelectedMicrophone(trackId);
            } else if (microphones.length > 0) {
              setSelectedMicrophone(microphones[0].deviceId);
            }
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error("미디어 권한 에러:", err);
        setMediaError("카메라 또는 마이크 권한이 필요합니다.");
      }
    }

    setupMedia();

    return () => {
      isMountedRef.current = false;
      // 클린업
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      stopAudio();
    };
  }, []);

  // 디바이스 변경
  async function changeDevice(type: "video" | "audio", deviceId: string) {
    try {
      if (type === "video") {
        if (deviceId === "none") {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          if (videoRef.current) videoRef.current.srcObject = null;
        } else {
          const newVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
          });
          if (streamRef.current)
            streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = newVideoStream;
          if (videoRef.current) videoRef.current.srcObject = newVideoStream;
        }
        setSelectedCamera(deviceId);
      } else {
        // Audio 변경
        if (deviceId === "none") {
          stopAudio();
        } else {
          await startAudio(deviceId);
        }
        setSelectedMicrophone(deviceId);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("디바이스 변경 에러:", err);
    }
  }

  function adjustDuration(amount: number) {
    setForm((f) => {
      const next = f.scheduledDurationMinutes + amount;
      return {
        ...f,
        scheduledDurationMinutes: Math.max(10, Math.min(120, next)),
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const rid = isNewUpload ? uploadedResumeId : selectedResumeId;
    if (rid) {
      try {
        const data = await getResume(rid);
        setConfirmResumeStatus(data.resume.status);
      } catch {
        setConfirmResumeStatus(
          existingResumes.find((r) => r.id === rid)?.status ?? null,
        );
      }
    } else {
      setConfirmResumeStatus(null);
    }
    setShowConfirmModal(true);
  }

  // 이력서 상태 폴링 (모달 열림 + PROCESSING/PENDING일 때만 3초 간격)
  useEffect(() => {
    if (!showConfirmModal) return;
    if (
      confirmResumeStatus !== "PROCESSING" &&
      confirmResumeStatus !== "PENDING"
    )
      return;

    const rid = isNewUpload ? uploadedResumeId : selectedResumeId;
    if (!rid) return;

    const timer = setInterval(async () => {
      try {
        const data = await getResume(rid);
        setConfirmResumeStatus(data.resume.status);
      } catch {
        /* silent */
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [
    showConfirmModal,
    confirmResumeStatus,
    isNewUpload,
    uploadedResumeId,
    selectedResumeId,
  ]);

  const handleRefreshStatus = async () => {
    const rid = isNewUpload ? uploadedResumeId : selectedResumeId;
    if (!rid) return;
    setStatusRefreshing(true);
    try {
      const data = await getResume(rid);
      setConfirmResumeStatus(data.resume.status);
    } catch {
      /* silent */
    } finally {
      setStatusRefreshing(false);
    }
  };

  const handleResumeClickInModal = async () => {
    const resumeId = isNewUpload ? uploadedResumeId : selectedResumeId;
    if (!resumeId) return;

    setDetailLoading(true);
    try {
      const data = await getResume(resumeId);
      setDetail(data.resume); // Fixed type access
    } catch (err) {
      setError("이력서 정보를 가져오는 데 실패했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  async function handleFinalConfirm() {
    setError("");
    setLoading(true);
    try {
      let resumeId: string | undefined =
        selectedResumeId && !isNewUpload
          ? selectedResumeId
          : uploadedResumeId || undefined;

      const payload: CreateInterviewReq = {
        ...form,
        resumeId,
        participatingPersonas: selectedRoles,
        personality: "COMFORTABLE", // Default to COMFORTABLE as other fields are removed
      };

      const { interviewId } = await createInterview(payload);

      const meta = {
        ...payload,
        selectedCamera,
        selectedMicrophone,
      };

      sessionStorage.setItem(
        `interview-meta-${interviewId}`,
        JSON.stringify(meta),
      );

      // 스트림 정지
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      navigate(`/interview/${interviewId}`, { replace: true, state: meta });
    } catch (err) {
      setError(err instanceof Error ? err.message : "인터뷰 생성 실패");
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link to="/" className={styles.backButton}>
          ← 홈으로
        </Link>
        <h1 className={styles.headerTitle}>면접 설정</h1>
      </header>

      <main className={styles.content}>
        <div className={styles.container}>
          {/* 미디어 테스트 섹션 */}
          <section className={styles.mediaSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>🎥</span>
              <h2>미디어 테스트</h2>
            </div>

            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.video}
              />
            </div>

            <div className={styles.mediaSettingsCard}>
              {/* 카메라 설정 */}
              <div className={styles.deviceSelectGroup}>
                <label>
                  <span>🎥</span> 카메라 선택
                </label>
                <select
                  value={selectedCamera}
                  onChange={(e) => changeDevice("video", e.target.value)}
                  className={styles.select}
                >
                  <option value="none">사용 안 함</option>
                  {devices.cameras.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `카메라 ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 마이크 및 오디오 설정 */}
              <div className={styles.deviceSelectGroup}>
                <label>
                  <span>🎙️</span> 마이크 선택
                </label>
                <select
                  value={selectedMicrophone}
                  onChange={(e) => changeDevice("audio", e.target.value)}
                  className={styles.select}
                >
                  <option value="none">사용 안 함</option>
                  {devices.microphones.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `마이크 ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ paddingBottom: "0.25rem" }}>
                <AudioTester
                  stream={audioStream}
                  onTestComplete={() => setHasTestedAudio(true)}
                />
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <div className={styles.profileSection}>
              <div className={styles.profileHeader}>
                <div className={styles.profileAvatar}>
                  <span className={styles.avatarIcon}>👤</span>
                </div>
                <div className={styles.profileText}>
                  <h2>이력서 설정</h2>
                  <p>기존 이력서를 선택하거나 새 파일을 업로드하세요.</p>
                </div>
              </div>

              {resumesLoading ? (
                <div className={styles.resumeGrid}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.resumeCard}>
                      <div className={styles.resumeCardClickable}>
                        <Skeleton width={30} height={30} circle />
                        <div className={styles.resumeCardBody}>
                          <Skeleton
                            width={120}
                            height={18}
                            className={styles.mb05}
                          />
                          <Skeleton width={80} height={14} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : isNewUpload ? (
                <div className={styles.uploadArea}>
                  <div className={styles.uploadHeader}>
                    <h3>새 이력서 업로드</h3>
                    {existingResumes.length > 0 && (
                      <button
                        type="button"
                        className={styles.textBtn}
                        onClick={() => setIsNewUpload(false)}
                      >
                        기존 목록에서 선택
                      </button>
                    )}
                  </div>
                  <ResumeUploadZone
                    onFileSelect={handleFileSelect}
                    onAnalyzeStart={() => {
                      setValidating(true);
                    }}
                    onAnalyzeEnd={() => {
                      setValidating(false);
                    }}
                    onError={setError}
                    onSuccess={setSuccess}
                    enableUpload={true}
                    onUploadComplete={async (resumeId) => {
                      setUploadedResumeId(resumeId);
                      setSuccess("이력서가 업로드되었습니다!");
                      await loadResumes(); // 목록 갱신 대기
                      setIsNewUpload(false); // 목록 뷰로 전환
                      setSelectedResumeId(resumeId); // 방금 업로드한 이력서 선택
                    }}
                    existingResumes={existingResumes}
                  />
                </div>
              ) : (
                <div className={styles.resumeListArea}>
                  <div className={styles.uploadHeader}>
                    <h3>내 이력서 목록</h3>
                    <div className={styles.uploadHeaderActions}>
                      <button
                        type="button"
                        className={styles.refreshListBtn}
                        disabled={resumesLoading}
                        onClick={() => loadResumes()}
                        title="목록 새로고침"
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={() => setIsNewUpload(true)}
                      >
                        + 새 이력서 추가
                      </button>
                    </div>
                  </div>
                  <div className={styles.resumeGrid}>
                    {existingResumes.map((resume) => (
                      <div
                        key={resume.id}
                        className={`${styles.resumeCard} ${selectedResumeId === resume.id ? styles.resumeSelected : ""}`}
                      >
                        <div
                          className={styles.resumeCardClickable}
                          onClick={() => setSelectedResumeId(resume.id)}
                        >
                          <div className={styles.resumeCardIcon}>📄</div>
                          <div className={styles.resumeCardBody}>
                            <div className={styles.resumeCardTitle}>
                              {resume.title}
                            </div>
                            <div className={styles.resumeCardDate}>
                              {new Date(resume.createdAt).toLocaleDateString()}
                              <span
                                className={styles.resumeStatusBadge}
                                data-status={resume.status}
                              >
                                {resume.status}
                              </span>
                            </div>
                          </div>
                          {selectedResumeId === resume.id && (
                            <div className={styles.checkIcon}>✓</div>
                          )}
                        </div>
                        {resume.status === "FAILED" && (
                          <button
                            type="button"
                            className={styles.retryBtn}
                            disabled={retryingResumeId === resume.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setRetryingResumeId(resume.id);
                              try {
                                await retryResumeProcessing(resume.id);
                                await loadResumes();
                              } finally {
                                setRetryingResumeId(null);
                              }
                            }}
                          >
                            {retryingResumeId === resume.id
                              ? "재처리 중..."
                              : "재처리"}
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.viewDetailBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(resume.id);
                          }}
                        >
                          상세보기
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {/* 그룹 1: 면접 전략 및 구성 */}
              <div className={styles.setupGroup}>
                <div className={styles.groupInfo}>
                  <h3 className={styles.groupHeader}>🎯 면접 유형 선택</h3>
                  <p className={styles.groupDesc}>
                    지원하시는 차수에 맞춰 최적의 AI 면접관과 질문 세트가
                    구성됩니다.
                  </p>
                </div>

                <div className={styles.field}>
                  <label htmlFor="interview-round">면접 유형 (Round)</label>
                  <div className={styles.roundSelector}>
                    {[
                      {
                        id: "TECHNICAL",
                        label: "1차 면접",
                        icon: "⬡",
                        desc: "직무 역량과 기술 깊이 검증",
                      },
                      {
                        id: "CULTURE_FIT",
                        label: "2차 면접",
                        icon: "⌬",
                        desc: "조직 적합성 및 가치관 확인",
                      },
                      {
                        id: "EXECUTIVE",
                        label: "최종 면접",
                        icon: "◈",
                        desc: "비즈니스 통찰력 및 잠재력 평가",
                      },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`${styles.roundBtn} ${form.round === r.id ? styles.active : ""}`}
                        data-round={r.id}
                        onClick={() => setForm({ ...form, round: r.id as any })}
                      >
                        <span className={styles.roundIcon}>{r.icon}</span>
                        <div className={styles.roundBtnText}>
                          <span className={styles.roundLabel}>{r.label}</span>
                          <span className={styles.roundDesc}>{r.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label>면접관 구성</label>
                  <div className={styles.personaGrid}>
                    {[
                      {
                        id: "LEADER",
                        title: "리드 면접관",
                        desc: "종합 역량 및 경험 평가",
                        icon: "👨‍💼",
                      },
                      {
                        id: "TECH",
                        title: "기술 면접관",
                        desc: "실무 기술 역량 검증",
                        icon: "💻",
                      },
                      {
                        id: "HR",
                        title: "인사 면접관",
                        desc: "인성 및 조직 문화 적합성",
                        icon: "🤝",
                      },
                      {
                        id: "EXEC",
                        title: "임원 면접관",
                        desc: "비즈니스 가치관 평가",
                        icon: "◈",
                      },
                    ].map((p) => {
                      const isMandatory = getMandatoryPersonas(
                        form.round,
                      ).includes(p.id as InterviewPersona);
                      const isSelected = selectedRoles.includes(
                        p.id as InterviewPersona,
                      );

                      return (
                        <div
                          key={p.id}
                          className={`${styles.personaCard} ${isSelected ? styles.selected : ""} ${isMandatory ? styles.mandatory : ""}`}
                          onClick={() => toggleRole(p.id as InterviewPersona)}
                        >
                          <div className={styles.cardIcon}>{p.icon}</div>
                          <div className={styles.cardTitle}>
                            <span className={styles.cardTitleText}>
                              {p.title}
                            </span>
                            {isMandatory ? (
                              <span className={styles.mandatoryBadge}>
                                필수
                              </span>
                            ) : (
                              <span className={styles.optionalBadge}>
                                (선택)
                              </span>
                            )}
                          </div>
                          <div className={styles.cardDescription}>{p.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 그룹 2: 지원 정보 상세 */}
              <div className={styles.setupGroup}>
                <div className={styles.groupInfo}>
                  <h3 className={styles.groupHeader}>🏢 지원 정보 상세</h3>
                  <p className={styles.groupDesc}>
                    기업명과 공고 URL을 기반으로 더욱 정교한 맞춤형 질문을
                    생성합니다.
                  </p>
                </div>

                <div className={styles.topInfoRow}>
                  <div className={styles.field}>
                    <label htmlFor="companyName">회사명 (선택)</label>
                    <input
                      id="companyName"
                      type="text"
                      value={form.companyName ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, companyName: e.target.value })
                      }
                      className={styles.input}
                      placeholder="예: 네이버, 카카오, 토스"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="domain">직무</label>
                    <input
                      id="domain"
                      type="text"
                      value={form.domain}
                      onChange={(e) =>
                        setForm({ ...form, domain: e.target.value })
                      }
                      className={styles.input}
                      placeholder="예: 프론트엔드, 백엔드"
                      required
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="jobPostingUrl">채용 공고 URL (선택)</label>
                  <input
                    id="jobPostingUrl"
                    type="url"
                    value={form.jobPostingUrl}
                    onChange={(e) =>
                      setForm({ ...form, jobPostingUrl: e.target.value })
                    }
                    className={styles.input}
                    placeholder="https://link.to/job-post"
                  />
                </div>
              </div>

              <div className={`${styles.field} ${styles.durationField}`}>
                <label>목표 시간 (분, 10~120)</label>
                <div className={styles.durationSelector}>
                  <div className={styles.durationBtns}>
                    <button
                      type="button"
                      className={styles.durationBtn}
                      onClick={() => adjustDuration(-30)}
                    >
                      -30m
                    </button>
                    <button
                      type="button"
                      className={styles.durationBtn}
                      onClick={() => adjustDuration(-10)}
                    >
                      -10m
                    </button>
                  </div>

                  <div className={styles.durationDisplay}>
                    {isEditingDuration ? (
                      <input
                        type="number"
                        min={10}
                        max={120}
                        autoFocus
                        className={styles.durationInput}
                        value={form.scheduledDurationMinutes}
                        onBlur={() => setIsEditingDuration(false)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setIsEditingDuration(false)
                        }
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            scheduledDurationMinutes: Number(e.target.value),
                          }))
                        }
                      />
                    ) : (
                      <div
                        className={styles.durationValue}
                        onClick={() => setIsEditingDuration(true)}
                      >
                        <span>{form.scheduledDurationMinutes}</span>
                        <small>분</small>
                      </div>
                    )}
                  </div>

                  <div className={styles.durationBtns}>
                    <button
                      type="button"
                      className={styles.durationBtn}
                      onClick={() => adjustDuration(10)}
                    >
                      +10m
                    </button>
                    <button
                      type="button"
                      className={styles.durationBtn}
                      onClick={() => adjustDuration(30)}
                    >
                      +30m
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || validating}
                className={styles.btn}
              >
                {loading
                  ? "면접 생성 중…"
                  : validating
                    ? "AI 분석 중…"
                    : "면접 시작"}
              </button>
            </form>
          </section>
        </div>
      </main>

      {(error || mediaError || success) && (
        <Toast
          message={error || mediaError || success}
          onClose={() => {
            setError("");
            setMediaError("");
            setSuccess("");
          }}
          autoDismissMs={5000}
        />
      )}

      {/* 이력서 상세보기 모달 */}
      {detail &&
        createPortal(
          <div className={styles.modalOverlay} onClick={closeDetail}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>{detail.title}</h2>
                <button className={styles.closeBtn} onClick={closeDetail}>
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                {detailLoading ? (
                  <div className={styles.detailLoadingSkeleton}>
                    <Skeleton width="100%" height={24} className={styles.mb1} />
                    <Skeleton width="90%" height={24} className={styles.mb1} />
                    <Skeleton width="95%" height={24} className={styles.mb1} />
                    <Skeleton width="80%" height={24} />
                  </div>
                ) : detail.fileUrl ? (
                  <div className={styles.pdfViewerContainer}>
                    <PremiumResumeViewer fileUrl={detail.fileUrl} />
                  </div>
                ) : (
                  <div className={styles.loading}>
                    파일 URL을 찾을 수 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 면접 시작 전 최종 확인 모달 */}
      {showConfirmModal &&
        createPortal(
          <div
            className={styles.modalOverlay}
            onClick={() => {
              setShowConfirmModal(false);
              setConfirmResumeStatus(null);
            }}
          >
            <div
              className={`${styles.modalContent} ${styles.confirmModalContent}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>🚀 면접 시작 전 최종 확인</h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmResumeStatus(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <div className={styles.confirmBody}>
                {/* 설정 요약 */}
                <div className={styles.summarySection}>
                  <div className={styles.summaryTitle}>설정 요약</div>
                  <div className={styles.summaryGrid}>
                    {(selectedResumeId || uploadedResumeId) && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>이력서</span>
                        <div className={styles.resumeSummaryValue}>
                          <span
                            className={styles.summaryValueClickable}
                            onClick={handleResumeClickInModal}
                            title="클릭하여 확인하기"
                          >
                            {existingResumes.find(
                              (r) => r.id === selectedResumeId,
                            )?.title ||
                              (uploadedResumeId && "새로 업로드된 이력서") ||
                              "선택된 이력서"}
                          </span>
                          <div className={styles.resumeStatusRow}>
                            {confirmResumeStatus && (
                              <span
                                className={styles.resumeStatusBadge}
                                data-status={confirmResumeStatus}
                              >
                                {confirmResumeStatus}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={handleRefreshStatus}
                              className={styles.refreshStatusBtn}
                              title="상태 새로고침"
                            >
                              {statusRefreshing ? "…" : "↻"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>면접 유형</span>
                      <span className={styles.summaryValue}>
                        {form.round === "TECHNICAL"
                          ? "1차 면접"
                          : form.round === "CULTURE_FIT"
                            ? "2차 면접"
                            : "최종 면접"}
                      </span>
                    </div>
                    {form.companyName && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>지원 기업</span>
                        <span className={styles.summaryValue}>
                          {form.companyName}
                        </span>
                      </div>
                    )}
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>직무 분야</span>
                      <span className={styles.summaryValue}>{form.domain}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>목표 시간</span>
                      <span className={styles.summaryValue}>
                        {form.scheduledDurationMinutes}분
                      </span>
                    </div>
                    {form.jobPostingUrl && (
                      <div
                        className={styles.summaryItem}
                        style={{ gridColumn: "1 / -1" }}
                      >
                        <span className={styles.summaryLabel}>공고 URL</span>
                        <span
                          className={styles.summaryValue}
                          style={{
                            fontSize: "0.8rem",
                            opacity: 0.8,
                            wordBreak: "break-all",
                          }}
                        >
                          {form.jobPostingUrl}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 음성 체크 상태 */}
                <div
                  className={`${styles.audioStatus} ${hasTestedAudio ? styles.tested : styles.pending}`}
                >
                  {hasTestedAudio ? (
                    <>✅ 음성 테스트를 완료했습니다.</>
                  ) : (
                    <>⚠️ 아직 음성 테스트를 진행하지 않았습니다. (선택 사항)</>
                  )}
                </div>

                {/* 이력서 상태 안내 */}
                {(confirmResumeStatus === "PROCESSING" ||
                  confirmResumeStatus === "PENDING") && (
                  <div className={styles.statusWarningBlock}>
                    <span className={styles.statusSpinner} />
                    이력서를 분석 중입니다. 완료 전 시작하면 이력서 기반 질문이
                    제한될 수 있습니다.
                  </div>
                )}
                {confirmResumeStatus === "FAILED" && (
                  <div className={styles.statusErrorBlock}>
                    ⚠️ 이력서 처리에 실패했습니다. 지금 시작하면 이력서 없이
                    면접이 진행됩니다.
                  </div>
                )}
                {(!selectedCamera ||
                  selectedCamera === "none" ||
                  !selectedMicrophone ||
                  selectedMicrophone === "none") && (
                  <div className={styles.statusErrorBlock}>
                    ⚠️ 카메라와 마이크를 먼저 선택해 주세요.
                  </div>
                )}

                {/* 체크리스트 */}
                <div className={styles.checklistSection}>
                  <label className={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={checklist.media}
                      onChange={(e) =>
                        setChecklist({ ...checklist, media: e.target.checked })
                      }
                    />
                    <span className={styles.checkText}>
                      카메라와 마이크가 잘 작동하는지 확인했습니다.
                    </span>
                  </label>
                  {((!isNewUpload && !selectedResumeId) ||
                    (!uploadedResumeId && isNewUpload) ||
                    (confirmResumeStatus !== null &&
                      confirmResumeStatus !== "COMPLETED")) && (
                    <label className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={checklist.resumeRisk}
                        onChange={(e) =>
                          setChecklist({
                            ...checklist,
                            resumeRisk: e.target.checked,
                          })
                        }
                      />
                      <span className={styles.checkText}>
                        {(!isNewUpload && !selectedResumeId) ||
                        (!uploadedResumeId && isNewUpload)
                          ? "선택된 이력서가 없습니다. 이력서 없이 면접을 시작합니다."
                          : "이력서 처리가 완료되지 않은 상태에서 면접을 시작합니다."}
                      </span>
                    </label>
                  )}
                  <label className={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={checklist.ready}
                      onChange={(e) =>
                        setChecklist({ ...checklist, ready: e.target.checked })
                      }
                    />
                    <span className={styles.checkText}>
                      면접 준비가 모두 완료되었습니다.
                    </span>
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmResumeStatus(null);
                  }}
                >
                  취소
                </button>
                <button
                  className={styles.startFinalBtn}
                  onClick={handleFinalConfirm}
                  disabled={
                    loading ||
                    !selectedCamera ||
                    selectedCamera === "none" ||
                    !selectedMicrophone ||
                    selectedMicrophone === "none" ||
                    !checklist.media ||
                    !checklist.ready ||
                    (((!isNewUpload && !selectedResumeId) ||
                      (!uploadedResumeId && isNewUpload) ||
                      (confirmResumeStatus !== null &&
                        confirmResumeStatus !== "COMPLETED")) &&
                      !checklist.resumeRisk)
                  }
                >
                  {loading ? "면접 생성 중..." : "확인 후 시작하기"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
