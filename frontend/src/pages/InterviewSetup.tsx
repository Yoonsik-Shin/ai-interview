import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  createInterview,
  type CreateInterviewReq,
  type InterviewRole,
  type InterviewPersonality,
} from "@/api/interview";
import {
  listResumes,
  getResume,
  type ResumeItem,
  type ResumeDetail,
} from "@/api/resumes";
import { Toast } from "@/components/Toast";
import { ResumeUploadZone } from "@/components/ResumeUploadZone";
import { PremiumResumeViewer } from "@/components/PremiumResumeViewer";
import { Skeleton } from "@/components/Skeleton";
import styles from "./InterviewSetup.module.css";

export function InterviewSetup() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  // State
  const [selectedRoles, setSelectedRoles] = useState<InterviewRole[]>([
    "LEADER",
    "TECH",
  ]);
  const [personality, setPersonality] =
    useState<InterviewPersonality>("COMFORTABLE");

  const [form, setForm] = useState<
    Omit<CreateInterviewReq, "resumeId" | "interviewerRoles" | "personality">
  >({
    domain: "프론트엔드",
    type: "PRACTICE",
    targetDurationMinutes: 30,
    selfIntroduction: "",
  });

  const toggleRole = (role: InterviewRole) => {
    if (role === "LEADER") return; // LEADER is mandatory
    setSelectedRoles((prev) => {
      const isSelected = prev.includes(role);
      if (isSelected) {
        if (prev.length === 1) return prev; // At least one
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

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setError("");
      setUploadedResumeId(null);
    }
  };

  // 이력서 목록 가져오기
  useEffect(() => {
    async function loadResumes() {
      try {
        const list = await listResumes();
        setExistingResumes(list.resumes);
        if (list.resumes.length === 0) {
          setIsNewUpload(true);
        } else {
          setSelectedResumeId(list.resumes[0].id);
        }
      } catch (err) {
        console.error("이력서 목록 로드 실패:", err);
      } finally {
        setResumesLoading(false);
      }
    }
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const [audioLevel, setAudioLevel] = useState(0);
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
        // 미디어 권한 요청
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isMountedRef.current) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        streamRef.current = mediaStream;

        // 비디오 프리뷰 설정
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // 디바이스 목록 가져오기
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (!isMountedRef.current) return;

        const cameras = deviceList.filter((d) => d.kind === "videoinput");
        const microphones = deviceList.filter((d) => d.kind === "audioinput");
        setDevices({ cameras, microphones });

        // 현재 사용 중인 디바이스 설정
        const videoTrack = mediaStream.getVideoTracks()[0];
        const audioTrack = mediaStream.getAudioTracks()[0];
        if (videoTrack)
          setSelectedCamera(videoTrack.getSettings().deviceId || "");
        if (audioTrack)
          setSelectedMicrophone(audioTrack.getSettings().deviceId || "");

        // 오디오 레벨 분석
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function updateAudioLevel() {
          if (!isMountedRef.current || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255); // 0-1 범위로 정규화
          animationIdRef.current = requestAnimationFrame(updateAudioLevel);
        }
        updateAudioLevel();
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, []);

  // 디바이스 변경
  async function changeDevice(type: "video" | "audio", deviceId: string) {
    try {
      // 1. 기존 오디오 관련 리소스 명시적 정리
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;

      // 2. 계산된 새로운 비디오/오디오 제약조건 설정
      const newCameraId = type === "video" ? deviceId : selectedCamera;
      const newMicId = type === "audio" ? deviceId : selectedMicrophone;

      const constraints: MediaStreamConstraints = {
        video:
          newCameraId === "none" || !newCameraId
            ? false
            : { deviceId: { exact: newCameraId } },
        audio:
          newMicId === "none" || !newMicId
            ? false
            : { deviceId: { exact: newMicId } },
      };

      // 3. 둘 다 "none"이면 스트림 정지하고 null 처리
      if (
        (newCameraId === "none" || !newCameraId) &&
        (newMicId === "none" || !newMicId)
      ) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setAudioLevel(0);
        // State update
        if (type === "video") setSelectedCamera("none");
        else setSelectedMicrophone("none");
        return;
      }

      // 4. 새 스트림 요청
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!isMountedRef.current) {
        newStream.getTracks().forEach((t) => t.stop());
        return;
      }

      // 5. 기존 스트림 정지 (새 스트림 성공 후)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // 6. 오디오 분석기 재연결 (오디오가 있는 경우만)
      if (newMicId !== "none" && newMicId) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(newStream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function updateAudioLevel() {
          if (!isMountedRef.current || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          animationIdRef.current = requestAnimationFrame(updateAudioLevel);
        }
        updateAudioLevel();
      } else {
        setAudioLevel(0);
      }

      // 7. Selection State Update
      if (type === "video") setSelectedCamera(deviceId);
      else setSelectedMicrophone(deviceId);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("디바이스 변경 에러:", err);
    }
  }

  function adjustDuration(amount: number) {
    setForm((f) => {
      const next = f.targetDurationMinutes + amount;
      return {
        ...f,
        targetDurationMinutes: Math.max(10, Math.min(120, next)),
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let resumeId: string | undefined =
        selectedResumeId && !isNewUpload
          ? selectedResumeId
          : uploadedResumeId || undefined;

      // 새 업로드인데 업로드가 안 되어 있으면 에러
      if (isNewUpload && !uploadedResumeId) {
        setError("이력서를 먼저 업로드해주세요.");
        setLoading(false);
        return;
      }
      const payload: CreateInterviewReq = {
        ...form,
        resumeId,
        interviewerRoles: selectedRoles,
        personality: personality,
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

            <div className={styles.mediaControls}>
              {/* 카메라 선택 */}
              <div className={styles.deviceSelect}>
                <label>카메라</label>
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

              {/* 마이크 선택 및 레벨 */}
              <div className={styles.deviceSelect}>
                <label>마이크 및 오디오 레벨</label>
                <select
                  value={selectedMicrophone}
                  onChange={(e) => changeDevice("audio", e.target.value)}
                  className={styles.select}
                  style={{ marginBottom: "1rem" }}
                >
                  <option value="none">사용 안 함</option>
                  {devices.microphones.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `마이크 ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
                <div className={styles.levelBar}>
                  <div
                    className={styles.levelFill}
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
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
                    onUploadComplete={(resumeId) => {
                      setUploadedResumeId(resumeId);
                      setSuccess("이력서가 업로드되었습니다!");
                    }}
                    existingResumes={existingResumes}
                  />
                </div>
              ) : (
                <div className={styles.resumeListArea}>
                  <div className={styles.uploadHeader}>
                    <h3>내 이력서 목록</h3>
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => setIsNewUpload(true)}
                    >
                      + 새 이력서 추가
                    </button>
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
                            </div>
                          </div>
                          {selectedResumeId === resume.id && (
                            <div className={styles.checkIcon}>✓</div>
                          )}
                        </div>
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

            <h2 className={styles.formTitle}>면접 상세 설정</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="domain">도메인</label>
                <input
                  id="domain"
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  className={styles.input}
                  placeholder="예: 프론트엔드, 자바 백엔드"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="interview-type">면접 타입</label>
                <select
                  id="interview-type"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as any })
                  }
                  className={styles.input}
                >
                  <option value="REAL">실전 면접 (정밀 분석, 유료)</option>
                  <option value="PRACTICE">모의 면접 (빠른 처리, 무료)</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="personality">면접 분위기 (성격)</label>
                <select
                  id="personality"
                  value={personality}
                  onChange={(e) =>
                    setPersonality(e.target.value as InterviewPersonality)
                  }
                  className={styles.input}
                >
                  <option value="COMFORTABLE">편안한 (격려하는 분위기)</option>
                  <option value="PRESSURE">엄격한 (압박 면접 분위기)</option>
                  <option value="RANDOM">랜덤</option>
                </select>
              </div>

              <div className={styles.field}>
                <label>면접관 구성 (복수 선택 가능)</label>
                <div className={styles.personaGrid}>
                  {[
                    {
                      id: "LEADER",
                      title: "리드 면접관",
                      desc: "리더십 및 종합 및 경험 평가",
                      icon: "👨‍💼",
                    },
                    {
                      id: "TECH",
                      title: "기술 면접관",
                      desc: "기술 역량 검증",
                      icon: "💻",
                    },
                    {
                      id: "HR",
                      title: "인사 면접관",
                      desc: "조직 적합성 및 인성 확인",
                      icon: "🤝",
                    },
                  ].map((p) => {
                    const isSelected = selectedRoles.includes(
                      p.id as InterviewRole,
                    );
                    return (
                      <div
                        key={p.id}
                        className={`${styles.personaCard} ${isSelected ? styles.selected : ""} ${p.id === "LEADER" ? styles.mandatory : ""}`}
                        onClick={() => toggleRole(p.id as InterviewRole)}
                      >
                        <div className={styles.cardIcon}>{p.icon}</div>
                        <div className={styles.cardTitle}>
                          {p.title}
                          {p.id === "LEADER" && (
                            <span className={styles.mandatoryBadge}>필수</span>
                          )}
                        </div>
                        <div className={styles.cardDescription}>{p.desc}</div>
                      </div>
                    );
                  })}
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
                        value={form.targetDurationMinutes}
                        onBlur={() => setIsEditingDuration(false)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setIsEditingDuration(false)
                        }
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            targetDurationMinutes: Number(e.target.value),
                          }))
                        }
                      />
                    ) : (
                      <div
                        className={styles.durationValue}
                        onClick={() => setIsEditingDuration(true)}
                      >
                        <span>{form.targetDurationMinutes}</span>
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
                  ? "생성 중…"
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
      {detail && (
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
        </div>
      )}
    </div>
  );
}
