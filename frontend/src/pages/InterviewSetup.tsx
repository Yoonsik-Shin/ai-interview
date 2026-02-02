import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  createInterview,
  type CreateInterviewReq,
  type InterviewType,
  type InterviewPersona,
} from "@/api/interview";
import { uploadResume } from "@/api/resumes";
import styles from "./InterviewSetup.module.css";

export function InterviewSetup() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [form, setForm] = useState<Omit<CreateInterviewReq, "resumeId">>({
    domain: "프론트엔드",
    type: "PRACTICE",
    persona: "COMFORTABLE",
    interviewerCount: 1,
    targetDurationMinutes: 30,
    selfIntroduction: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 미디어 관련 상태
  const [stream, setStream] = useState<MediaStream | null>(null);
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
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let animationId: number;

    async function setupMedia() {
      try {
        // 미디어 권한 요청
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);

        // 비디오 프리뷰 설정
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // 디바이스 목록 가져오기
        const deviceList = await navigator.mediaDevices.enumerateDevices();
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
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function updateAudioLevel() {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255); // 0-1 범위로 정규화
          animationId = requestAnimationFrame(updateAudioLevel);
        }
        updateAudioLevel();
      } catch (err) {
        console.error("미디어 권한 에러:", err);
        setMediaError("카메라 또는 마이크 권한이 필요합니다.");
      }
    }

    setupMedia();

    return () => {
      // 클린업
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // 디바이스 변경
  async function changeDevice(type: "video" | "audio", deviceId: string) {
    try {
      // 1. 계산된 새로운 비디오/오디오 제약조건 설정
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

      // 2. 둘 다 "none"이면 스트림 정지하고 null 처리
      if (
        (newCameraId === "none" || !newCameraId) &&
        (newMicId === "none" || !newMicId)
      ) {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        setStream(null);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        // State update
        if (type === "video") setSelectedCamera("none");
        else setSelectedMicrophone("none");
        return;
      }

      // 3. 새 스트림 요청
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 4. 기존 스트림 정지 (새 스트림 성공 후)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // 5. 상태 업데이트
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // 6. 오디오 분석기 재연결 (오디오가 있는 경우만)
      if (newMicId !== "none" && newMicId) {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(newStream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function updateAudioLevel() {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateAudioLevel);
        }
        updateAudioLevel();
      } else {
        setAudioLevel(0);
      }

      // 7. Selection State Update
      if (type === "video") setSelectedCamera(deviceId);
      else setSelectedMicrophone(deviceId);
    } catch (err) {
      console.error("디바이스 변경 에러:", err);
      // 에러 시 상태 롤백 혹은 에러 표시 (여기선 간단히 콘솔 로그)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let resumeId: number | undefined;
      if (resumeFile) {
        const { resumeId: id } = await uploadResume(
          resumeFile,
          resumeFile.name,
        );
        resumeId = id;
      }
      const payload: CreateInterviewReq = resumeId
        ? { ...form, resumeId }
        : form;
      const { interviewId } = await createInterview(payload);
      const meta = {
        interviewerCount: form.interviewerCount,
        persona: form.persona,
        type: form.type,
        domain: form.domain,
        targetDurationMinutes: form.targetDurationMinutes,
        selectedCamera,
        selectedMicrophone,
      };
      sessionStorage.setItem(
        `interview-meta-${interviewId}`,
        JSON.stringify(meta),
      );

      // 스트림 정지
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
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
        <button className={styles.backButton} onClick={() => navigate("/")}>
          ← 홈으로
        </button>
        <h1>면접 설정</h1>
        <p>카메라와 마이크를 테스트하고 면접을 시작하세요</p>
      </header>

      <div className={styles.container}>
        {/* 미디어 테스트 섹션 */}
        <div className={styles.mediaSection}>
          <h2>미디어 테스트</h2>

          {mediaError && <p className={styles.mediaError}>{mediaError}</p>}

          {/* 카메라 프리뷰 */}
          <div className={styles.videoContainer}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={styles.video}
            />
          </div>

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
            <label>마이크</label>
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

          {/* 오디오 레벨 표시 */}
          <div className={styles.audioLevel}>
            <label>마이크 레벨</label>
            <div className={styles.levelBar}>
              <div
                className={styles.levelFill}
                style={{ width: `${audioLevel * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* 프로필 및 면접 설정 */}
        <div className={styles.formSection}>
          <div className={styles.profileSection}>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>ME</div>
              <div>
                <h2>프로필</h2>
                <p>이력서를 업로드하면 질문 품질이 향상됩니다.</p>
              </div>
            </div>
            <label className={styles.fileLabel} htmlFor="resume-upload">
              이력서 업로드
            </label>
            <div className={styles.fileInputWrapper}>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                className={styles.fileInput}
              />
              <span className={styles.fileInputText}>
                {resumeFile ? "다른 파일 선택" : "파일 선택"}
              </span>
            </div>
            <p className={styles.fileHint}>PDF, DOC, DOCX 파일만 지원합니다.</p>
            <p className={styles.fileName}>
              {resumeFile ? resumeFile.name : "선택된 파일 없음"}
            </p>
          </div>

          <h2 className={styles.formTitle}>면접 설정</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>도메인</label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) =>
                  setForm((f) => ({ ...f, domain: e.target.value }))
                }
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>면접 타입</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as InterviewType,
                  }))
                }
                className={styles.input}
              >
                <option value="PRACTICE">모의 면접 (빠른 처리, 무료)</option>
                <option value="REAL">실전 면접 (고품질, OpenAI)</option>
              </select>
              <p className={styles.fieldHint}>
                {form.type === "PRACTICE"
                  ? "⚡ 빠른 처리 | STT: Fast Whisper, TTS: Edge TTS"
                  : "🎯 고품질 | STT: OpenAI Whisper, TTS: OpenAI TTS"}
              </p>
            </div>
            <div className={styles.field}>
              <label>페르소나</label>
              <select
                value={form.persona}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    persona: e.target.value as InterviewPersona,
                  }))
                }
                className={styles.input}
              >
                <option value="PRESSURE">압박</option>
                <option value="COMFORTABLE">편안한</option>
                <option value="RANDOM">랜덤</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>면접관 수 (1~4)</label>
              <input
                type="number"
                min={1}
                max={4}
                value={form.interviewerCount}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    interviewerCount: Number(e.target.value),
                  }))
                }
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>목표 시간 (분, 10~120)</label>
              <input
                type="number"
                min={10}
                max={120}
                value={form.targetDurationMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetDurationMinutes: Number(e.target.value),
                  }))
                }
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label>자기소개</label>
              <textarea
                value={form.selfIntroduction}
                onChange={(e) =>
                  setForm((f) => ({ ...f, selfIntroduction: e.target.value }))
                }
                rows={4}
                placeholder="간단한 자기소개를 입력하세요."
                className={styles.input}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} className={styles.btn}>
              {loading ? "생성 중…" : "면접 시작"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
