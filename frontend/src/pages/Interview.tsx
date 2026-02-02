import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  useInterviewSocket,
  InterviewStage,
  type StageChangedEvent,
  type InterveneEvent,
} from "@/hooks/useInterviewSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import type { InterviewPersona, InterviewType } from "@/api/interview";
import styles from "./Interview.module.css";

type Message = {
  id: string;
  type: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
};

type TtsChunk = { sentenceIndex: number; audioData: string; duration?: number };

type InterviewMeta = {
  interviewerCount: number;
  persona: InterviewPersona;
  type: InterviewType;
  domain: string;
  targetDurationMinutes: number;
  selectedCamera?: string;
  selectedMicrophone?: string;
};

type ConversationState = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING";

export function Interview() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const location = useLocation();
  const id = interviewId || null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState<string | null>(null);
  const [interviewMeta, setInterviewMeta] = useState<InterviewMeta | null>(
    null,
  );
  const [videoError, setVideoError] = useState("");
  const [conversationState, setConversationState] =
    useState<ConversationState>("IDLE");
  const [manualPaused, setManualPaused] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamBufRef = useRef("");
  const appendStreamRef = useRef<(token: string) => void>(() => {});
  const ttsQueueRef = useRef<TtsChunk[]>([]);
  const ttsPlayingRef = useRef(false);
  const hasSpeechRef = useRef(false);
  const speechStartTsRef = useRef<number | null>(null);
  const silenceStartTsRef = useRef<number | null>(null);
  const onLevelRef = useRef<(level: number, ts: number) => void>(() => {});

  // Media Control State
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState<{
    cameras: MediaDeviceInfo[];
    microphones: MediaDeviceInfo[];
  }>({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");

  const {
    connected,
    error,
    sendAudioChunk,
    notifyStageReady,
    setOnStt,
    setOnTranscript,
    setOnThinking,
    setOnAudio,
    setOnAck,
    setOnStageChanged,
    setOnIntervene,
    setOnRetryAnswer,
  } = useInterviewSocket(id);

  const [currentStage, setCurrentStage] = useState<InterviewStage>(
    InterviewStage.WAITING,
  );
  const [intervention, setIntervention] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChunk = useCallback(
    (payload: {
      chunk: string;
      interviewSessionId: string;
      isFinal?: boolean;
      format?: string;
      sampleRate?: number;
      chunkId?: string;
    }) => {
      // 발화가 감지되었거나 마지막 청크인 경우에만 전송
      if (payload.isFinal || hasSpeechRef.current) {
        if (id != null) sendAudioChunk({ ...payload, interviewSessionId: id });
      }
    },
    [id, sendAudioChunk],
  );

  const { start, stop, sendFinal, recording, micError } = useAudioRecorder(
    id ?? "",
    handleChunk,
    {
      onLevel: (level, ts) => onLevelRef.current(level, ts),
    },
  );

  const finalizeStreamingMessage = useCallback(() => {
    streamBufRef.current = "";
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === "assistant" && last.isStreaming) {
        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      }
      return prev;
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    sendFinal();
    stop();
    setThinking(null);
    setConversationState("PROCESSING");
    finalizeStreamingMessage();
    hasSpeechRef.current = false;
    setIsUserSpeaking(false);
    speechStartTsRef.current = null;
    silenceStartTsRef.current = null;
  }, [finalizeStreamingMessage, recording, sendFinal, stop]);

  const startRecording = useCallback(async () => {
    if (recording || manualPaused) return;
    hasSpeechRef.current = false;
    speechStartTsRef.current = null;
    silenceStartTsRef.current = null;
    await start(selectedMicrophone || undefined);
    setConversationState("LISTENING");
  }, [manualPaused, recording, start, selectedMicrophone]);

  // Video Stream Logic
  const initVideo = useCallback(async (deviceId?: string) => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }

      if (deviceId === "none") {
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setCameraOn(false);
        setVideoError("");
        return;
      }

      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setVideoError("");
      setCameraOn(true);

      // Update selected camera if not set
      const track = stream.getVideoTracks()[0];
      if (track && !deviceId) {
        setSelectedCamera(track.getSettings().deviceId || "");
      }
    } catch (err) {
      console.error("Camera init error:", err);
      setVideoError("카메라를 사용할 수 없습니다.");
      setCameraOn(false);
    }
  }, []);

  // Initialize Devices & Stream on Mount
  useEffect(() => {
    const init = async () => {
      // Load devices
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          cameras: deviceList.filter((d) => d.kind === "videoinput"),
          microphones: deviceList.filter((d) => d.kind === "audioinput"),
        });
      } catch (err) {
        console.error("Device enumerate error:", err);
      }

      // Check for passed state
      let camId = "";
      let micId = "";

      if (location.state) {
        const meta = location.state as Partial<InterviewMeta>;
        if (meta.selectedCamera) camId = meta.selectedCamera;
        if (meta.selectedMicrophone) micId = meta.selectedMicrophone;
      } else if (id) {
        // Fallback to session storage
        const saved = sessionStorage.getItem(`interview-meta-${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.selectedCamera) camId = parsed.selectedCamera;
          if (parsed.selectedMicrophone) micId = parsed.selectedMicrophone;
        }
      }

      setSelectedCamera(camId);
      setSelectedMicrophone(micId);

      // Init video
      await initVideo(camId || undefined);
    };
    init();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, [id, location.state, initVideo]);

  // Change Device Handlers
  const handleChangeCamera = async (deviceId: string) => {
    setSelectedCamera(deviceId);
    await initVideo(deviceId);
  };

  const handleChangeMic = async (deviceId: string) => {
    setSelectedMicrophone(deviceId);
    if (recording) {
      stopRecording();
    }
  };

  const handleAudioLevel = useCallback(
    (level: number, ts: number) => {
      if (!recording || manualPaused || conversationState !== "LISTENING")
        return;
      const SPEECH_START_THRESHOLD = 0.05;
      const SPEECH_END_THRESHOLD = 0.035;
      const SILENCE_DURATION_MS = 800;
      const MIN_SPEECH_DURATION_MS = 250;
      const now = ts;

      if (!hasSpeechRef.current) {
        if (level > SPEECH_START_THRESHOLD) {
          hasSpeechRef.current = true;
          setIsUserSpeaking(true);
          speechStartTsRef.current = now;
          silenceStartTsRef.current = null;
        }
        return;
      }

      if (level > SPEECH_END_THRESHOLD) {
        silenceStartTsRef.current = null;
        return;
      }

      if (silenceStartTsRef.current == null) {
        silenceStartTsRef.current = now;
        return;
      }

      const silenceDuration = now - silenceStartTsRef.current;
      const speechDuration = speechStartTsRef.current
        ? silenceStartTsRef.current - speechStartTsRef.current
        : 0;

      if (
        speechDuration >= MIN_SPEECH_DURATION_MS &&
        silenceDuration >= SILENCE_DURATION_MS
      ) {
        stopRecording();
        setConversationState("PROCESSING");
        hasSpeechRef.current = false;
        speechStartTsRef.current = null;
        silenceStartTsRef.current = null;
      }
    },
    [conversationState, manualPaused, recording, stopRecording],
  );

  onLevelRef.current = handleAudioLevel;

  // Keep track of currentStage in a ref for callbacks
  const currentStageRef = useRef(currentStage);
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  useEffect(() => {
    if (!id) return;
    const stateMeta = location.state as Partial<InterviewMeta> | null;
    if (stateMeta?.interviewerCount) {
      setInterviewMeta(stateMeta as InterviewMeta);
    } else {
      const saved = sessionStorage.getItem(`interview-meta-${id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as InterviewMeta;
          setInterviewMeta(parsed);
        } catch {
          // ignore
        }
      }
    }
  }, [id, location.state]);

  const playNextTts = useCallback(() => {
    if (ttsPlayingRef.current || ttsQueueRef.current.length === 0) return;
    const next = ttsQueueRef.current.shift();
    if (!next?.audioData) {
      ttsPlayingRef.current = false;
      playNextTts();
      return;
    }
    ttsPlayingRef.current = true;
    if (recording) stopRecording();
    setConversationState("SPEAKING");
    setIsInterviewerSpeaking(true);

    const shouldResumeRecording = () => {
      const allowedStages = [
        InterviewStage.GREETING,
        InterviewStage.SELF_INTRO,
        InterviewStage.IN_PROGRESS,
      ];
      return allowedStages.includes(currentStageRef.current);
    };

    try {
      const binary = atob(next.audioData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        ttsPlayingRef.current = false;
        setIsInterviewerSpeaking(false);

        // INTERVIEWER_INTRO 단계에서 오디오 재생이 끝나면 백엔드에 알림 (-> SELF_INTRO 전환)
        if (currentStageRef.current === InterviewStage.INTERVIEWER_INTRO) {
          notifyStageReady(InterviewStage.INTERVIEWER_INTRO);
        }

        // Only resume recording if in an allowed stage
        if (!manualPaused && connected && shouldResumeRecording()) {
          startRecording();
        } else {
          setConversationState(connected ? "IDLE" : "IDLE");
        }
        playNextTts();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        ttsPlayingRef.current = false;
        setIsInterviewerSpeaking(false);
        if (!manualPaused && connected && shouldResumeRecording()) {
          startRecording();
        } else {
          setConversationState(connected ? "IDLE" : "IDLE");
        }
        playNextTts();
      };
      audio.play().catch(() => {
        ttsPlayingRef.current = false;
        setIsInterviewerSpeaking(false);
        if (!manualPaused && connected && shouldResumeRecording()) {
          startRecording();
        } else {
          setConversationState(connected ? "IDLE" : "IDLE");
        }
        playNextTts();
      });
    } catch {
      ttsPlayingRef.current = false;
      setIsInterviewerSpeaking(false);
      if (!manualPaused && connected && shouldResumeRecording()) {
        startRecording();
      } else {
        setConversationState(connected ? "IDLE" : "IDLE");
      }
      playNextTts();
    }
  }, [
    connected,
    manualPaused,
    recording,
    startRecording,
    stopRecording,
    notifyStageReady,
  ]);

  useEffect(() => {
    setOnAudio((e: TtsChunk) => {
      if (!e.audioData) return;
      ttsQueueRef.current.push(e);
      playNextTts();
    });
  }, [setOnAudio, playNextTts]);

  useEffect(() => {
    appendStreamRef.current = (token: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === "assistant" && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, text: last.text + token }];
        }
        return [
          ...prev,
          {
            id: `a-${Date.now()}`,
            type: "assistant",
            text: token,
            isStreaming: true,
          },
        ];
      });
    };
  }, []);

  /* Toggle Handlers */
  const handleToggleMic = useCallback(() => {
    if (micOn) {
      setMicOn(false);
      stopRecording();
      setManualPaused(true);
    } else {
      setMicOn(true);
      setManualPaused(false);
      if (connected) startRecording();
    }
  }, [micOn, connected, stopRecording, startRecording]);

  const handleToggleCamera = useCallback(() => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOn;
    });
    setCameraOn(!cameraOn);
  }, [cameraOn]);

  const [interviewersJoined, setInterviewersJoined] = useState(false);

  /* Socket Callbacks */
  useEffect(() => {
    setOnRetryAnswer((e) => {
      console.log("Retry requested:", e.message);

      if (recording) stopRecording();

      const personaKey = interviewMeta?.persona || "RANDOM";
      const engineKey = interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
      const audioPath = `/audio/please_repeat_${personaKey}_${engineKey}.mp3`;

      const audio = new Audio(audioPath);

      setIsInterviewerSpeaking(true);
      setConversationState("SPEAKING");

      audio.onended = () => {
        setIsInterviewerSpeaking(false);
        if (!manualPaused && connected) {
          startRecording();
        } else {
          setConversationState("IDLE");
        }
      };

      audio.onerror = () => {
        console.error("Failed to play retry audio:", audioPath);
        setIsInterviewerSpeaking(false);
        if (!manualPaused && connected) {
          startRecording();
        } else {
          setConversationState("IDLE");
        }
      };

      audio.play().catch((err) => {
        console.error("Audio play error:", err);
        setIsInterviewerSpeaking(false);
        if (!manualPaused && connected) {
          startRecording();
        }
      });
    });

    setOnStageChanged((e: StageChangedEvent) => {
      console.log(`Stage changed: ${e.previousStage} -> ${e.currentStage}`);
      setCurrentStage(e.currentStage);

      if (e.currentStage === InterviewStage.GREETING_PROMPT) {
        setTimeout(() => {
          const personaKey = interviewMeta?.persona || "RANDOM";
          const audioPath = `/audio/greeting_${personaKey}_edge.mp3`;
          if (audioRef.current) {
            audioRef.current.src = audioPath;
            audioRef.current.onended = () => {
              notifyStageReady(InterviewStage.GREETING_PROMPT);
            };
            audioRef.current.play().catch((err) => {
              console.error("인사말 재생 실패:", err);
              notifyStageReady(InterviewStage.GREETING_PROMPT);
            });
          }
        }, 1500);
      } else if (e.currentStage === InterviewStage.SELF_INTRO) {
        setTimeLeft(90);
      } else if (e.currentStage === InterviewStage.IN_PROGRESS) {
        setTimeLeft(null);
      }
    });

    setOnIntervene((e: InterveneEvent) => {
      console.log(`Intervention received: ${e.message}`);
      setIntervention(e.message);

      setMessages((prev) => [
        ...prev,
        {
          id: `intervene-${Date.now()}`,
          type: "assistant",
          text: e.message,
        },
      ]);

      setTimeout(() => setIntervention(null), 5000);
    });

    setOnStt((data) => {
      if (data.text) {
        setSubtitle(data.text);

        if (subtitleTimeoutRef.current) {
          clearTimeout(subtitleTimeoutRef.current);
        }

        subtitleTimeoutRef.current = setTimeout(() => {
          setSubtitle(null);
        }, 3000);
      }
    });
  }, [
    setOnStageChanged,
    setOnIntervene,
    setOnStt,
    setOnRetryAnswer,
    interviewMeta,
    recording,
    stopRecording,
    manualPaused,
    connected,
    startRecording,
    notifyStageReady,
  ]);

  useEffect(() => {
    if (
      connected &&
      currentStage !== InterviewStage.WAITING &&
      !interviewersJoined
    ) {
      const timer = setTimeout(() => {
        setInterviewersJoined(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [connected, currentStage, interviewersJoined]);

  useEffect(() => {
    if (!connected) {
      setConversationState("IDLE");
      return;
    }
    if (!micOn || manualPaused || ttsPlayingRef.current) return;

    const autoRecordStages = [
      InterviewStage.GREETING,
      InterviewStage.SELF_INTRO,
      InterviewStage.IN_PROGRESS,
    ];
    if (!recording && autoRecordStages.includes(currentStage)) {
      startRecording();
    }
  }, [connected, manualPaused, recording, startRecording, micOn, currentStage]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (
      currentStage === InterviewStage.SELF_INTRO &&
      timeLeft !== null &&
      timeLeft > 0
    ) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStage, timeLeft]);

  if (id == null)
    return <div className={styles.wrap}>유효하지 않은 인터뷰입니다.</div>;

  const interviewerCount = Math.max(
    1,
    Math.min(interviewMeta?.interviewerCount ?? 1, 6),
  );
  const interviewerRoles = [
    "리드 면접관",
    "기술 면접관",
    "실무 면접관",
    "문화 면접관",
    "프로덕트 면접관",
    "리크루터",
  ];

  const personaLabel =
    interviewMeta?.persona === "PRESSURE"
      ? "압박"
      : interviewMeta?.persona === "RANDOM"
        ? "랜덤"
        : "편안";

  return (
    <div className={styles.wrap}>
      {(!connected || currentStage === InterviewStage.WAITING) && (
        <div className={styles.connectingOverlay}>
          <div className={styles.spinner}></div>
          <p>
            {connected
              ? "면접실에 연결 중입니다..."
              : "서버에 연결 중입니다..."}
          </p>
        </div>
      )}

      <div className={styles.infoOverlay}>
        <div className={styles.sessionInfo}>
          <span className={styles.timerBadge}>
            {conversationState === "LISTENING"
              ? "Listening..."
              : conversationState}
          </span>
          <span className={styles.divider}>|</span>
          <span className={styles.personaBadge}>{personaLabel} 모드</span>
          {timeLeft !== null && timeLeft > 0 && (
            <>
              <span className={styles.divider}>|</span>
              <span
                className={styles.timerBadge}
                style={{ color: timeLeft < 10 ? "#ef4444" : "inherit" }}
              >
                자기소개 남은 시간: {timeLeft}초
              </span>
            </>
          )}
          <span
            className={styles.connectionDot}
            style={{ background: connected ? "#4ade80" : "#fbbf24" }}
          />
        </div>
        {(error || micError) && (
          <div className={styles.errorBanner}>{error || micError}</div>
        )}

        <div className={styles.stageIndicator}>
          <div className={styles.stageStatus}>
            <span className={styles.stageLabel}>진행 단계</span>
            <span className={styles.stageValue}>{currentStage}</span>
          </div>
          {timeLeft !== null && (
            <div className={styles.stageTimer}>
              <span className={styles.timerLabel}>자기소개 시간</span>
              <span className={styles.timerValue}>
                {Math.floor(timeLeft / 60)}:
                {(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>

      {intervention && (
        <div className={styles.interventionOverlay}>
          <div className={styles.interventionContent}>
            <div className={styles.interventionHeader}>
              <span className={styles.interventionIcon}>💡</span>
              <span className={styles.interventionTitle}>면접관 개입</span>
            </div>
            <p className={styles.interventionMessage}>{intervention}</p>
          </div>
        </div>
      )}

      {subtitle && (
        <div className={styles.subtitleOverlay}>
          <span className={styles.subtitleText}>{subtitle}</span>
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.videoGrid}>
          <div
            className={`${styles.videoTile} ${isUserSpeaking ? styles.speaking : ""}`}
          >
            <div className={styles.tileHeader}>
              <span className={styles.tileLabel}>나 (지원자)</span>
              {!micOn && <span className={styles.mutedIcon}>🔇</span>}
            </div>
            {videoError ? (
              <div className={styles.videoPlaceholder}>{videoError}</div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.video}
                style={{ opacity: cameraOn ? 1 : 0 }}
              />
            )}
            {!cameraOn && (
              <div className={styles.cameraOffPlaceholder}>카메라 꺼짐</div>
            )}
          </div>

          {Array.from({ length: interviewerCount }).map((_, idx) => (
            <div
              key={`interviewer-${idx}`}
              className={`${styles.interviewerTile} ${isInterviewerSpeaking ? styles.speaking : ""}`}
            >
              <div className={styles.tileHeader}>
                <span className={styles.tileLabel}>면접관 {idx + 1}</span>
                <span className={styles.roleBadge}>
                  {interviewerRoles[idx % interviewerRoles.length]}
                </span>
              </div>
              <div className={styles.interviewerAvatar}>
                {!interviewersJoined ? (
                  <div className={styles.joiningMessage}>
                    면접관이 입장하고 있습니다...
                  </div>
                ) : (
                  <>
                    <div className={styles.avatarCircle}>IV</div>
                    {thinking && (
                      <div className={styles.thinkingBubble}>Thinking...</div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSettings && (
        <div
          className={styles.settingsOverlay}
          onClick={() => setShowSettings(false)}
        >
          <div
            className={styles.settingsModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.settingsHeader}>
              <h2>설정</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.settingsContent}>
              <div className={styles.settingField}>
                <label>카메라</label>
                <select
                  className={styles.select}
                  value={selectedCamera}
                  onChange={(e) => handleChangeCamera(e.target.value)}
                >
                  <option value="none">사용 안 함</option>
                  {devices.cameras.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `카메라 ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.settingField}>
                <label>마이크</label>
                <select
                  className={styles.select}
                  value={selectedMicrophone}
                  onChange={(e) => handleChangeMic(e.target.value)}
                >
                  <option value="none">사용 안 함</option>
                  {devices.microphones.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `마이크 ${d.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className={styles.controlBar}>
        <div className={styles.controlsLeft}>
          <span className={styles.timeInfo}>00:00:00</span>
        </div>

        <div className={styles.controlsCenter}>
          <button
            type="button"
            onClick={handleToggleMic}
            className={`${styles.controlBtn} ${!micOn ? styles.btnDanger : ""}`}
          >
            {micOn ? "🎤 음소거" : "🔇 음소거 해제"}
          </button>

          <button
            type="button"
            onClick={handleToggleCamera}
            className={`${styles.controlBtn} ${!cameraOn ? styles.btnDanger : ""}`}
          >
            {cameraOn ? "📹 비디오 중지" : "📷 비디오 시작"}
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={styles.controlBtn}
          >
            ⚙️ 설정
          </button>
        </div>

        <div className={styles.controlsRight}>
          <Link to="/" className={styles.exitBtn}>
            나가기
          </Link>
        </div>
      </footer>
      <audio ref={audioRef} hidden />
    </div>
  );
}
