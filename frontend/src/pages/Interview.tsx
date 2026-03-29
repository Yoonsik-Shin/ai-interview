import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  useInterviewSocket,
  InterviewStage,
  type StageChangedEvent,
  type InterveneEvent,
  type TurnStateEvent,
} from "@/hooks/useInterviewSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useVideoRecorder } from "@/hooks/useVideoRecorder";
import { useInterviewProtection } from "@/hooks/useInterviewProtection";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { DevToolPanel } from "@/components/DevTool/DevToolPanel";
import type {
  InterviewPersona,
} from "@/api/interview";
import styles from "./Interview.module.css";

type TtsChunk = {
  sentenceIndex: number;
  audioData?: string; // Base64 (Streaming TTS)
  localPath?: string; // Local URL (Greeting, Guides, etc.)
  duration?: number;
  text?: string;
  persona?: string;
};

type InterviewMeta = {
  participatingPersonas?: InterviewPersona[];
  interviewerCount: number;
  domain: string;
  scheduledDurationMinutes: number;
  selectedCamera?: string;
  selectedMicrophone?: string;
  ttsEngine?: string;
};

type AudioCategory =
  | "greeting"
  | "closing"
  | "prompt"
  | "guide"
  | "feedback"
  | "fillers";

function getAudioPath(
  category: AudioCategory,
  action: string,
  persona: string,
) {
  // New structure: /audio/{PERSONA}/{category}/{action}_edge.mp3
  return `/audio/${persona}/${category}/${action}_edge.mp3`;
}

const TURN_POLICY = {
  ANSWER_END_SILENCE_MS: 1500,
  SELF_INTRO_END_SILENCE_MS: 3000,
  CANDIDATE_GREETING_END_SILENCE_MS: 1000, // 인사 단계 VAD 완화
  INACTIVITY_PROMPT_MS: 10000, // 10초 무응답 가이드
  SELF_INTRO_HARD_TIMEOUT_SEC: 90,
} as const;

function resolveRoleVoice(persona?: string | null) {
  if (persona === "LEADER") return "MAIN";
  return persona || "MAIN";
}

function getStaticAudioPath(
  category: AudioCategory,
  action: string,
  persona?: string | null,
) {
  const roleVoice = resolveRoleVoice(persona);
  return getAudioPath(category, action, roleVoice);
}

type ConversationState = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING";

export function Interview() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const id = interviewId || null;
  const [thinking, setThinking] = useState<string | null>(null);
  const [interviewMeta, setInterviewMeta] = useState<InterviewMeta | null>(
    null,
  );

  // 인터뷰 세션 참여자 중 가이드 음성을 담당할 리드 역할을 결정합니다.
  const resolveLeadRole = (
    personas: InterviewPersona[] | null | undefined,
  ): InterviewPersona => {
    if (!personas || personas.length === 0) return "TECH";
    const priority: InterviewPersona[] = ["LEADER", "MAIN", "EXEC", "HR", "TECH"];
    for (const p of priority) {
      if (personas.includes(p)) return p;
    }
    return personas[0];
  };

  const [videoError, setVideoError] = useState("");
  const [conversationState, setConversationState] =
    useState<ConversationState>("IDLE");
  const [manualPaused, setManualPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false); // Ref -> State로 변경 (Effect 동기화용)
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const playNextTtsRef = useRef<() => void>(() => {});

  const stopAllAudio = useCallback(() => {
    // 2. Stop current dynamic TTS audio
    if (currentTtsAudioRef.current) {
      currentTtsAudioRef.current.pause();
      currentTtsAudioRef.current.src = "";
      currentTtsAudioRef.current = null;
    }

    // 3. Clear queue and reset states
    if (fillerTimeoutRef.current) {
      clearTimeout(fillerTimeoutRef.current);
      fillerTimeoutRef.current = null;
    }
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    setIsInterviewerSpeaking(false);
    setConversationState("IDLE");
  }, []);

  const streamBufRef = useRef("");
  const appendStreamRef = useRef<(token: string) => void>(() => {});
  const ttsQueueRef = useRef<TtsChunk[]>([]);
  const ttsPlayingRef = useRef(false);
  const hasSpeechRef = useRef(false);
  const speechStartTsRef = useRef<number | null>(null);
  const silenceStartTsRef = useRef<number | null>(null);
  const selfIntroSegmentStartedRef = useRef(false);
  const onLevelRef = useRef<(level: number, ts: number) => void>(() => {});
  const onSpeechStartRef = useRef<() => void>(() => {});
  const onSpeechEndRef = useRef<() => void>(() => {});

  // Media Control State
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const turnEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stageReadyCalledRef = useRef<string | null>(null); // 중복 트리거 방지 플래그 추가
  const pendingStageAudioRef = useRef<TtsChunk | null>(null); // STAGE_CHANGE 오디오 지연 재생용
  const [pendingAiPlayback, setPendingAiPlayback] = useState(false);
  const pendingAiPlaybackRef = useRef(false);
  useEffect(() => {
    pendingAiPlaybackRef.current = pendingAiPlayback;
  }, [pendingAiPlayback]);
  const fillerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setOnAudio,
    setOnStageChanged,
    setOnTurnState,
    setOnIntervene,
    setOnRetryAnswer,
    setOnResumeProcessed,
    setOnDebugTrace,
    joinDebugTrace,
    socket,
    isTraceJoined,
    requestRetry,
  } = useInterviewSocket(id);

  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const turnCountRef = useRef(0);
  const pendingFirstQuestionRef = useRef(false);
  const [currentStage, setCurrentStage] = useState<InterviewStage>(
    InterviewStage.WAITING,
  );
  const [turnState, setTurnState] = useState<TurnStateEvent | null>(null);
  const [intervention, setIntervention] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [currentPersonaId, setCurrentPersonaId] = useState<string | null>(null); // New State
  const [timeReducedToast, setTimeReducedToast] = useState(false);
  const [showSelfIntroGuide, setShowSelfIntroGuide] = useState(false);
  const [sttHistory, setSttHistory] = useState<string[]>([]); // New State
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // Elapsed timer

  // Accessibility States
  const [showSubtitles, setShowSubtitles] = useState(() => {
    return localStorage.getItem("interview_show_subtitles") === "true";
  });
  const [enableTextInput, setEnableTextInput] = useState(() => {
    return localStorage.getItem("interview_enable_text_input") === "true";
  });
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Elapsed Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (currentStage !== InterviewStage.WAITING && currentStage !== InterviewStage.COMPLETED && connected) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStage, connected]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
  };

  const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subtitleRef = useRef<{ timeout: NodeJS.Timeout | null; isAiActive: boolean }>({
    timeout: null,
    isAiActive: false,
  });
  const isStoppingRef = useRef(false);
  const recordingRef = useRef(false);

  // 3-Layer Defense System
  const isInterviewActive =
    currentStage !== InterviewStage.WAITING &&
    currentStage !== InterviewStage.COMPLETED;

  useInterviewSession(id, currentStage, isInterviewActive);
  
  const handleChunk = useCallback(
    (payload: {
      chunk: string | ArrayBuffer;
      interviewId: string;
      isFinal?: boolean;
      format?: string;
      sampleRate?: number;
      chunkId?: string;
    }) => {
      // [FIX] conversationState가 LISTENING이 아니거나, 인터뷰어 발화 중이면 전송 차단
      if (conversationState !== "LISTENING" || isInterviewerSpeaking || ttsPlayingRef.current) {
        return;
      }

      // 발화가 감지되었거나 마지막 청크인 경우에만 전송
      if (payload.isFinal || hasSpeechRef.current) {
        if (id != null) sendAudioChunk({ ...payload, interviewId: id });
      }
    },
    [conversationState, id, sendAudioChunk],
  );

  const { start, stop, sendFinal, recording, micError } = useAudioRecorder(
    id ?? "",
    handleChunk,
    {
      onLevel: (level, ts) => onLevelRef.current(level, ts),
      onSpeechStart: () => onSpeechStartRef.current(),
      onSpeechEnd: () => onSpeechEndRef.current(),
    },
  );

  const { startSegment, stopSegment, recoverPendingUploads } = useVideoRecorder(id, streamRef);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const finalizeStreamingMessage = useCallback(() => {
    streamBufRef.current = "";
  }, []);

  // Socket Handler Updates
  useEffect(() => {
    setOnTranscript((tokenData) => {
      if (tokenData.type === "clear_turn") {
        finalizeStreamingMessage();
        streamBufRef.current = "";
        subtitleRef.current.isAiActive = false;
        setSubtitle(null);
        setSttHistory([]); // [FIX] 새로운 턴 시작 시 이전 STT 히스토리 삭제
      }

      // [FIX] 첫 번째 질문이나 다음 질문의 토큰이 도착하거나, 전송이 완료되면 가드 해제
      if (pendingFirstQuestionRef.current && (tokenData.token || tokenData.type === "sentence" || tokenData.type === "turn_complete" || tokenData.isFinal)) {
        pendingFirstQuestionRef.current = false;
      }

      // [FIX] 턴이 완료되었음을 알리는 신호가 오면 AiPlayback 중단 허용
      if (tokenData.type === "turn_complete" || tokenData.isFinal) {
        pendingAiPlaybackRef.current = false; // 이제 오디오가 다 나오면 IDLE/LISTENING으로 갈 수 있음
      }

      // Handle STT or full text transcript
      const transcriptText = tokenData.token || (tokenData as any).text || (tokenData as any).content;
      
      if (transcriptText) {
        if (tokenData.token) {
          setPendingAiPlayback(true);
          pendingAiPlaybackRef.current = true; // [FIX] Ref 즉시 업데이트하여 IDLE 레이스 컨디션 방지
          appendStreamRef.current(tokenData.token);
        }
        
        // Accumulate subtitles if enabled
        if (showSubtitles) {
          setSubtitle((prev) => {
            // 토큰 기반인 경우 누적, 완성형인 경우 교체 (STT 결과 등)
            const newSubtitle = tokenData.token ? (prev || "") + tokenData.token : transcriptText;
            
            // Clear subtitle after 5 seconds of no new segments
            if (subtitleRef.current.timeout) clearTimeout(subtitleRef.current.timeout);
            subtitleRef.current.timeout = setTimeout(() => {
              if (subtitleRef.current.isAiActive) setSubtitle(null);
            }, 5000);
            return newSubtitle;
          });
          subtitleRef.current.isAiActive = !!tokenData.token;
        }
      }

      // Handle Thinking
      if (tokenData.thinking) {
        setThinking(tokenData.thinking);
      } else {
        setThinking(null);
      }

      // Handle Adaptive Signals
      if (tokenData.reduceTotalTime) {
        setTimeReducedToast(true);
        setTimeout(() => setTimeReducedToast(false), 3000);
      }

      if (tokenData.currentPersonaId) {
        setCurrentPersonaId(tokenData.currentPersonaId);
      }

      // [NEW] Turn Complete sync for video recording
      if (tokenData.type === "turn_complete" && typeof tokenData.turnCount === "number") {
        if (import.meta.env.DEV) console.log(`Turn complete received. Syncing turnCount: ${tokenData.turnCount}`);
        turnCountRef.current = tokenData.turnCount;
        finalizeStreamingMessage();
      }
    });

    setOnResumeProcessed((e) => {
      if (import.meta.env.DEV) console.log("Resume processed notification received:", e);
      if (e.status === "COMPLETED") {
        setSubtitle("이력서 분석이 완료되었습니다. 면접 질문에 반영됩니다.");
        // 5초 뒤에 자막 제거
        if (subtitleTimeoutRef.current)
          clearTimeout(subtitleTimeoutRef.current);
        subtitleTimeoutRef.current = setTimeout(() => setSubtitle(null), 5000);
      }
    });
  }, [finalizeStreamingMessage, setOnTranscript, setOnResumeProcessed, showSubtitles]);

  const playFillerAudio = useCallback(() => {
    const leadRole = resolveLeadRole(interviewMeta?.participatingPersonas);
    const fillerActions = ["thanks", "next_q"]; // ack_short (네) 제거하여 혼란 방지
    const randomAction = fillerActions[Math.floor(Math.random() * fillerActions.length)];
    const audioPath = getStaticAudioPath("fillers", randomAction, leadRole);

    ttsQueueRef.current.push({
      sentenceIndex: -1,
      localPath: audioPath,
      persona: leadRole,
      text: "", // 추임새는 자막 제외
    });
    playNextTts();
  }, [interviewMeta]);

  const stopRecording = useCallback(() => {
    if (!recording || isStoppingRef.current) return;
    isStoppingRef.current = true;

    stop(); // Stop recording via hook

    setIsUserSpeaking(false);

    sendFinal(); // 정상 종료 시 Final chunk 전송

    setThinking(null);
    setConversationState("PROCESSING");
    setTimeLeft(null); // [FIX] 발화가 종료되면 90초 하드 리미트 타이머를 즉시 중단하여 간섭 방지
    finalizeStreamingMessage();
    hasSpeechRef.current = false;
    speechStartTsRef.current = null;
    silenceStartTsRef.current = null;
    listenWindowStartedAtRef.current = null;

    // Stop video segment upload (fire-and-forget)
    stopSegment().catch(console.error);

    // [NEW] Turn 1 이상인 경우(IN_PROGRESS 단계) 답변 종료 시 약 800ms 지연 후 추임새 재생
    if (turnCountRef.current > 0 && currentStageRef.current === InterviewStage.IN_PROGRESS) {
      if (fillerTimeoutRef.current) clearTimeout(fillerTimeoutRef.current);
      fillerTimeoutRef.current = setTimeout(() => {
        // 녹화가 다시 시작되지 않았고, 다른 오디오가 재생 중이지 않을 때만 실행
        if (!recordingRef.current && !ttsPlayingRef.current) {
          playFillerAudio();
        }
        fillerTimeoutRef.current = null;
      }, 800);
    }

    // 약간의 지연 후 중복 방지 해제 (또는 다음 녹음 시작 시 해제)
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 1000);
  }, [recording, stop, sendFinal, finalizeStreamingMessage, stopSegment, playFillerAudio]);

  const handlePauseInterview = useCallback(async () => {
    if (!id || isPausing) return;

    // 일시정지 중임을 표시하여 추가적인 녹화 시작 방지
    setIsPausing(true);

    // 진행 중인 녹화가 있다면 즉시 중단
    if (recording) {
      stopRecording();
    }

    // 진행 중인 상태(IN_PROGRESS 등)가 아닐 때는 일시정지 요청 생략 (Core 500 하위호환 에러 방지)
    if (
      currentStage === InterviewStage.WAITING ||
      currentStage === InterviewStage.GREETING ||
      currentStage === InterviewStage.CANDIDATE_GREETING
    ) {
      setIsPausing(false);
      return;
    }

    try {
      await fetch(`/api/v1/interviews/${id}/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });
    } catch (error) {
      console.error("Failed to pause interview:", error);
      setIsPausing(false);
    }
  }, [id, currentStage, isPausing, recording, stopRecording]);

  const { pauseInterview } = useInterviewProtection({
    interviewId: id || "",
    isActive: isInterviewActive,
    onPause: handlePauseInterview,
  });

  const handleExit = useCallback(async () => {
    if (isInterviewActive) {
      if (
        !window.confirm(
          "면접을 중단하고 나가시겠습니까?\n진행 상황은 저장되며 나중에 이어서 진행할 수 있습니다.",
        )
      ) {
        return;
      }
      try {
        await pauseInterview();
        // 소켓 연결 종료 등 정리 작업은 useEffect cleanup에서 처리됨
      } catch (error) {
        console.error("Pause failed during exit:", error);
        // 실패하더라도 나가기는 허용
      }
    }
    stopAllAudio();
    navigate("/");
  }, [isInterviewActive, pauseInterview, navigate, stopAllAudio]);

  const answerStages = [
    InterviewStage.CANDIDATE_GREETING,
    InterviewStage.SELF_INTRO,
    InterviewStage.IN_PROGRESS,
    InterviewStage.LAST_ANSWER,
  ];

  const startRecording = useCallback(async (deviceId?: string, redemptionMs?: number) => {
    if (recording || manualPaused || isPausing) return;
    isStoppingRef.current = false; // 녹음 시작 시 중단 방지 초기화
    hasSpeechRef.current = false;
    speechStartTsRef.current = null;
    silenceStartTsRef.current = null;
    listenWindowStartedAtRef.current = Date.now();
    await start(deviceId || selectedMicrophone || undefined, redemptionMs);
    setConversationState("LISTENING");

    // Start video segment for answer stages
    // SELF_INTRO: delay startSegment until first speech detected (VAD onSpeechStart)
    if (answerStages.includes(currentStageRef.current)) {
      if (currentStageRef.current === InterviewStage.SELF_INTRO) {
        selfIntroSegmentStartedRef.current = false;
      } else {
        // [FIX] 서버 상태와 동기화된 turnCount 사용 (로컬 ++ 제거)
        const turn = turnCountRef.current;
        startSegment(turn).catch(console.error);
      }
    }
  }, [manualPaused, recording, start, selectedMicrophone, startSegment]);

  // Video Stream Logic
  const initVideo = useCallback(async (deviceId?: string) => {
    try {
      if (streamRef.current) {
        (streamRef.current as MediaStream)
          .getTracks()
          .forEach((t: MediaStreamTrack) => t.stop());
        streamRef.current = null;
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

      // check if still mounted
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        return;
      }

      // RACE CONDITION PROTECTION: Stop anything that might have been set while we were awaiting
      if (streamRef.current) {
        (streamRef.current as MediaStream)
          .getTracks()
          .forEach((t: MediaStreamTrack) => t.stop());
      }
      streamRef.current = stream;

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
    isMountedRef.current = true;
    recoverPendingUploads().catch(console.error);
    const init = async () => {
      // Load devices
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (isMountedRef.current) {
          setDevices({
            cameras: deviceList.filter((d) => d.kind === "videoinput"),
            microphones: deviceList.filter((d) => d.kind === "audioinput"),
          });
        }
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

      if (isMountedRef.current) {
        setSelectedCamera(camId);
        setSelectedMicrophone(micId);
        // Init video
        await initVideo(camId || undefined);
      }
    };
    init();

    socket?.on("interview:timer_sync", (payload: { timeLeft: number }) => {
      if (import.meta.env.DEV) console.log("Timer sync received:", payload);
      if (isMountedRef.current) setTimeLeft(payload.timeLeft);
    });

    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        (streamRef.current as MediaStream)
          .getTracks()
          .forEach((t: MediaStreamTrack) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      stopAllAudio();
      stop(); // useAudioRecorder의 stop 호출
    };
  }, [id, location.state, initVideo, stop, stopAllAudio, recoverPendingUploads]);

  // Change Device Handlers
  const handleChangeCamera = async (deviceId: string) => {
    setSelectedCamera(deviceId);
    await initVideo(deviceId);
  };

  const handleChangeMic = async (deviceId: string) => {
    setSelectedMicrophone(deviceId);
    if (recording) {
      stopRecording();
      // 약간의 지연 후 재시작하거나, 사용자가 다시 켜도록 유도 (여기서는 우선 멈춤)
    }
  };

  const handleAudioLevel = useCallback(
    (level: number, ts: number) => {
      if (!recording || manualPaused || conversationState !== "LISTENING")
        return;
      const SPEECH_START_THRESHOLD = 0.015; // VAD 감도 상향(기존 0.05보다 작게)
      const SPEECH_END_THRESHOLD = 0.005;
      const SILENCE_DURATION_MS =
        currentStageRef.current === InterviewStage.SELF_INTRO
          ? TURN_POLICY.SELF_INTRO_END_SILENCE_MS
          : TURN_POLICY.ANSWER_END_SILENCE_MS;
      const MIN_SPEECH_DURATION_MS = 250;
      const now = ts;

      if (!hasSpeechRef.current) {
        if (level > SPEECH_START_THRESHOLD) {
          hasSpeechRef.current = true;
          setIsUserSpeaking(true);
          speechStartTsRef.current = now;
          silenceStartTsRef.current = null;
          // SELF_INTRO: start segment on first speech detection
          if (
            currentStageRef.current === InterviewStage.SELF_INTRO &&
            !selfIntroSegmentStartedRef.current
          ) {
            selfIntroSegmentStartedRef.current = true;
            const turn = turnCountRef.current;
            startSegment(turn).catch(console.error);
          }
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
        // [FIX] 정적 안내 단계 및 자기소개는 useAudioRecorder의 onSpeechEnd에서 고속 처리하므로 일반 답변시에만 동작
        if (currentStageRef.current === InterviewStage.CANDIDATE_GREETING || 
            currentStageRef.current === InterviewStage.SELF_INTRO) {
          return;
        }

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

  const handleSpeechStart = useCallback(() => {
    if (conversationState !== "LISTENING" || isInterviewerSpeaking || ttsPlayingRef.current) return;
    setIsUserSpeaking(true);
    hasSpeechRef.current = true;
    speechStartTsRef.current = Date.now();
  }, [conversationState, isInterviewerSpeaking]);

  const handleSpeechEnd = useCallback(() => {
    if (!hasSpeechRef.current) return;
    
    // [FIX] CANDIDATE_GREETING: 인사 종료 감지 시 즉시 다음 단계(INTERVIEWER_INTRO)로 전이 (STT 우회)
    if (currentStageRef.current === InterviewStage.CANDIDATE_GREETING) {
      console.log("Candidate greeting ended (VAD). Fast transitioning to INTERVIEWER_INTRO.");
      stopRecording();
      notifyStageReady(InterviewStage.CANDIDATE_GREETING);
      
      hasSpeechRef.current = false;
      setIsUserSpeaking(false);
      return;
    }

    // [REMOVE] SELF_INTRO: 리트라이 로직 완전 제거. 발화 종료 시 항상 일반 종료 처리.
    if (currentStageRef.current === InterviewStage.SELF_INTRO) {
      const speechDurationMs = speechStartTsRef.current ? Date.now() - speechStartTsRef.current : 0;

      // 2초 이상의 유효한 발화가 있으면 종료 처리 (백엔드에서 IN_PROGRESS로 전이)
      if (speechDurationMs > 2000) {
        console.log("Self intro end detected. Proceeding to next stage.");
        stopRecording();
      }
      
      hasSpeechRef.current = false;
      setIsUserSpeaking(false);
      return;
    }

    setIsUserSpeaking(false);
  }, [notifyStageReady, requestRetry, stopRecording]);

  onSpeechStartRef.current = handleSpeechStart;
  onSpeechEndRef.current = handleSpeechEnd;
  // Keep track of currentStage in a ref for callbacks
  const currentStageRef = useRef(currentStage);
  const turnStateRef = useRef<TurnStateEvent | null>(null);
  const stageStartTimeRef = useRef(Date.now()); // 스테이지 시작 시간 기록
  const selfIntroTimerExpiredRef = useRef(false);
  const inactivityPromptKeyRef = useRef<string | null>(null);
  const listenWindowStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

  useEffect(() => {
    turnStateRef.current = turnState;
  }, [turnState]);

  useEffect(() => {
    turnStateRef.current = turnState;
  }, [turnState]);

  useEffect(() => {
    const isQuestioningStage = [
      InterviewStage.CANDIDATE_GREETING,
      InterviewStage.SELF_INTRO,
      InterviewStage.IN_PROGRESS,
      InterviewStage.LAST_ANSWER,
    ].includes(currentStageRef.current);

    // [GUARD] 서버가 명시적으로 발화 가능하다고 했고, 질문 중인 스테이지일 때만 타이머 가동
    const shouldRunTimer =
      turnState?.canCandidateSpeak &&
      isQuestioningStage &&
      !showSelfIntroGuide &&
      !manualPaused;

    if (!shouldRunTimer) return;

    const timer = setInterval(() => {
      // [PRECISION CHECK] 매 초마다 실제 재생/녹음/발화 상태를 Ref/State로 재점검
      const isActuallyBusy =
        ttsPlayingRef.current ||
        ttsQueueRef.current.length > 0 ||
        isInterviewerSpeaking ||
        isUserSpeaking ||
        conversationState === "PROCESSING" ||
        thinking !== null;

      if (conversationState !== "LISTENING" || isActuallyBusy) {
        // AI가 생각 중이거나 말하는 중, 또는 사용자 발화 중이면 타이머 리셋
        listenWindowStartedAtRef.current = Date.now();
        return;
      }

      const promptKey = `${turnState?.stage || currentStageRef.current}:${turnCountRef.current}`;
      if (inactivityPromptKeyRef.current === promptKey) return;

      const baseTs =
        speechStartTsRef.current ||
        listenWindowStartedAtRef.current ||
        stageStartTimeRef.current;

      if (!baseTs) return;

      // [CRITICAL] 10초 무응답 시 안내 메시지 송출
      // [FIX] 첫 질문 대기 중(pendingFirstQuestionRef)이거나 유저가 이미 발화 중(isUserSpeaking)일 때는 발동 차단
      if (pendingFirstQuestionRef.current || isUserSpeaking) return;
      if (Date.now() - baseTs < TURN_POLICY.INACTIVITY_PROMPT_MS) return;
      inactivityPromptKeyRef.current = promptKey;

      const leadPersona =
        interviewMeta?.participatingPersonas?.find((persona) => persona === "LEADER") ||
        interviewMeta?.participatingPersonas?.[0] ||
        "LEADER";
      
      const promptText = "10초 이상 말씀이 없으셨습니다. 답변 부탁드립니다.";

      if (id) {
        socket?.emit("interview:system_message", {
          interviewId: id,
          content: promptText,
          stage: currentStageRef.current,
          personaId: leadPersona,
          turnCount: turnCountRef.current,
          sequenceNumber: 0,
        });
      }

    }, 1000);

    return () => clearInterval(timer);
  }, [
    conversationState,
    id,
    interviewMeta,
    showSelfIntroGuide,
    socket,
    turnState,
    isUserSpeaking,
    isInterviewerSpeaking,
    manualPaused,
  ]);

  useEffect(() => {
    if (!id) return;

    // Fetch initial interview state
    const fetchInterviewState = async () => {
      try {
        const response = await fetch(`/api/v1/interviews/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          // Set initial stage if available in response
          // We need to ensure the key matches.
          // Based on BFF GetInterviewResult: currentStage (string)
          if (data.currentStage) {
            // Map string to enum if needed, or cast
            setCurrentStage(data.currentStage as InterviewStage);
          }
          // [NEW] Sync initial turn count from server
          if (typeof data.turnCount === "number") {
            turnCountRef.current = data.turnCount;
            if (import.meta.env.DEV) console.log("Initial turnCount synced:", data.turnCount);
          }
        }
      } catch (e) {
        console.error("Failed to fetch interview state:", e);
      }
    };
    fetchInterviewState();

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
    // 1. If currently playing (TTS chunk), do nothing
    if (ttsPlayingRef.current) {
      return;
    }

    // 1-1. Queue가 비었을 때 pending stage audio가 있으면 큐에 삽입 (인터리빙 방지)
    if (ttsQueueRef.current.length === 0 && pendingStageAudioRef.current) {
      ttsQueueRef.current.push(pendingStageAudioRef.current);
      pendingStageAudioRef.current = null;
    }

    // 2. If Queue has items, play immediately
    if (ttsQueueRef.current.length > 0) {
      if (turnEndTimeoutRef.current) {
        clearTimeout(turnEndTimeoutRef.current);
        turnEndTimeoutRef.current = null;
      }

      const next = ttsQueueRef.current.shift();
      if (!next) {
        playNextTts();
        return;
      }

      if (next.persona) {
        setCurrentPersonaId(next.persona);
      }

      ttsPlayingRef.current = true;
      setTtsPlaying(true);
      // [Barge-in 차단] AI 발화 중에는 녹음을 멈추기만 하고, 발화 중단을 허용하지 않음
      if (recording) {
        setIsUserSpeaking(false);
        stop(); // recording hook의 stop만 호출하여 마이크 끔
      }

      setConversationState("SPEAKING");
      setIsInterviewerSpeaking(true);

      const cleanup = () => {
        ttsPlayingRef.current = false;
        setTtsPlaying(false);
        setIsInterviewerSpeaking(false);
        playNextTts();
      };

      try {
        let audio: HTMLAudioElement;
        let url = "";

        if (showSubtitles && next.text) {
          setSubtitle(next.text);
          subtitleRef.current.isAiActive = false;
          if (subtitleRef.current.timeout) clearTimeout(subtitleRef.current.timeout);
          subtitleRef.current.timeout = setTimeout(() => setSubtitle(null), 5000);
        }

        if (next.localPath) {
          // 로컬 안내 음성 처리
          url = next.localPath;
          audio = new Audio(url);
        } else if (next.audioData) {
          // 스트리밍 TTS 데이터 처리
          const binary = atob(next.audioData);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "audio/mpeg" });
          url = URL.createObjectURL(blob);
          audio = new Audio(url);
        } else {
          cleanup();
          return;
        }

        currentTtsAudioRef.current = audio;

        audio.onended = () => {
          if (!next.localPath && url) URL.revokeObjectURL(url);
          cleanup();
        };

        audio.onerror = (e) => {
          console.error("Audio playback error", e);
          if (!next.localPath && url) URL.revokeObjectURL(url);
          cleanup();
        };

        audio.play().catch((err) => {
          console.error("Audio play failed", err);
          if (!next.localPath && url) URL.revokeObjectURL(url);
          cleanup();
        });
      } catch (err) {
        console.error("Audio setup error", err);
        cleanup();
      }
      return;
    }

    const stagesRequiringReady = [
      InterviewStage.GREETING,
      InterviewStage.INTERVIEWER_INTRO,
      InterviewStage.SELF_INTRO_PROMPT,
      InterviewStage.LAST_QUESTION_PROMPT,
      InterviewStage.CLOSING_GREETING,
    ];

    // [FIX] STT가 필요 없는 정적 안내 단계는 전이 지연 시간을 최소화 (1.5s -> 0.2s)
    const isStaticStage = stagesRequiringReady.includes(currentStageRef.current);
    const turnEndDelay = isStaticStage ? 200 : 1500;

    turnEndTimeoutRef.current = setTimeout(() => {
      turnEndTimeoutRef.current = null;
      if (ttsQueueRef.current.length > 0) {
        playNextTts();
        return;
      }

      if (import.meta.env.DEV) console.log("Turn Ended. Stage:", currentStageRef.current);
      
      // [FIX] Ref 값을 사용하여 스케줄러 실행 시점의 최신 상태를 참조 (Stale Closure 방지)
      setPendingAiPlayback(false);
      // pendingAiPlaybackRef.current = false; // [REMOVED] 토큰 수신 중일 때 조기 초기화하면 IDLE로 빠질 수 있음

      const allowedStages = [
        InterviewStage.CANDIDATE_GREETING,
        InterviewStage.SELF_INTRO,
        InterviewStage.IN_PROGRESS,
        InterviewStage.LAST_ANSWER,
      ];

      if (
        allowedStages.includes(currentStageRef.current) &&
        turnStateRef.current?.canCandidateSpeak &&
        !pendingAiPlaybackRef.current
      ) {
        setConversationState("LISTENING");
      } else if (pendingAiPlaybackRef.current) {
        // AI playback is still pending (more chunks expected), stay in SPEAKING
        setConversationState("SPEAKING");
      } else {
        setConversationState("IDLE");
      }

      if (
        isStaticStage &&
        ttsQueueRef.current.length === 0 &&
        stageReadyCalledRef.current !== "READY_" + currentStageRef.current // 이미 호출된 경우 차단
      ) {
        stageReadyCalledRef.current = "READY_" + currentStageRef.current;
        notifyStageReady(currentStageRef.current);
      }
    }, turnEndDelay);
  }, [
    connected,
    manualPaused,
    recording,
    startRecording,
    stopRecording,
    notifyStageReady,
    showSubtitles,
  ]);

  useEffect(() => {
    playNextTtsRef.current = playNextTts;
  }, [playNextTts]);

  useEffect(() => {
    setOnAudio((e: TtsChunk) => {
      if (!e.audioData && !e.localPath) return;
      
      // [FIX] sentenceIndex가 있는 경우 정렬하여 큐에 삽입 (순서 보정)
      if (typeof e.sentenceIndex === "number" && e.sentenceIndex >= 0) {
        ttsQueueRef.current.push(e);
        ttsQueueRef.current.sort((a, b) => {
            // localPath(-1)는 항상 앞선 순서로 처리하거나, 인덱스 우선순위 부여
            const idxA = a.sentenceIndex ?? -1;
            const idxB = b.sentenceIndex ?? -1;
            return idxA - idxB;
        });
      } else {
        // 안내 음성 등은 즉시 큐 끝에 추가
        ttsQueueRef.current.push(e);
      }
      playNextTts();
    });
  }, [setOnAudio, playNextTts]);

  useEffect(() => {
    appendStreamRef.current = (_token: string) => {
      // Logic for appending to stream buffer or other UI state if needed
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
      if (connected && turnStateRef.current?.canCandidateSpeak) {
        // [FIX] 자기소개 VAD 시간을 1500ms로 늘려 발화 중 끊김 방지
        const redemptionMs = (currentStageRef.current === InterviewStage.CANDIDATE_GREETING) ? 400 
          : (currentStageRef.current === InterviewStage.SELF_INTRO) ? 1500 
          : 1500;
        startRecording(undefined, redemptionMs);
      }
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

  const handleSendText = useCallback((overrideText?: string) => {
    const textToSubmit = overrideText || typedText;
    if (!textToSubmit.trim() || !id) return;

    socket?.emit("interview:text_input", {
      interviewId: id,
      text: textToSubmit.trim(),
    });
  }, [id, typedText, socket]);

  const [interviewersJoined, setInterviewersJoined] = useState(false);

  /* Socket Callbacks */
  useEffect(() => {
    setOnTurnState((event: TurnStateEvent) => {
      console.log("[Socket] turn_state:", event);
      turnStateRef.current = event; // Update Ref immediately
      setTurnState(event);
      
      // [FIX] AI 안내 방송(PendingPlayback) 중에는 서버의 상태 업데이트를 무시하여
      // 음성 재생 도중 상태가 LISTENING으로 변해 녹음이 시작되는 현상을 방지합니다.
      if (pendingAiPlaybackRef.current) {
        if (import.meta.env.DEV) console.log("onTurnState: Ignoring update during AI playback.");
        return;
      }

      if (typeof event.turnCount === "number") {
        turnCountRef.current = event.turnCount;
      }
      if (event.activePersonaId) {
        setCurrentPersonaId(event.activePersonaId);
      }

      if (event.status === "THINKING") {
        setConversationState("PROCESSING");
      } else if (event.status === "LISTENING") {
        setConversationState("LISTENING");
        if (!listenWindowStartedAtRef.current) {
          listenWindowStartedAtRef.current = Date.now();
        }
      } else if (event.status === "SPEAKING") {
        setConversationState("SPEAKING");
      } else if (event.status === "COMPLETED") {
        // [FIX] AI 안내 방송(PendingPlayback) 중에는 서버의 COMPLETED 메시지를 무시하여
        // UI가 갑자기 IDLE로 변하는 레이스 컨디션을 방지합니다.
        if (pendingAiPlaybackRef.current) {
          if (import.meta.env.DEV) console.log("onTurnState: Ignoring COMPLETED during AI playback guard.");
          return;
        }

        // [FIX] 자기소개 단계에서 타이머가 작동 중인 경우 서버의 COMPLETED 메시지를 무시합니다.
        // 이는 지연된 STT 결과(Residue)에 의해 백엔드에서 잘못 발행된 상태일 가능성이 큽니다.
        if (currentStage === InterviewStage.SELF_INTRO && timeLeft !== null && timeLeft > 0) {
          if (import.meta.env.DEV) console.log("onTurnState: Ignoring COMPLETED during active SELF_INTRO timer.");
          return;
        }

        setConversationState("IDLE");
      }
    });

    setOnStageChanged((event: StageChangedEvent) => {
      console.log("[Socket] stage_changed:", event);
      const nextStage = event.currentStage;
      currentStageRef.current = nextStage; // Update Ref immediately
      setCurrentStage(nextStage);
      
      if (stageReadyCalledRef.current === "ENTERED_" + nextStage) {
        return;
      }
      stageReadyCalledRef.current = "ENTERED_" + nextStage;

      stageStartTimeRef.current = Date.now();
      inactivityPromptKeyRef.current = null;

      if (nextStage === InterviewStage.IN_PROGRESS) {
        setConversationState("PROCESSING");
        if (recordingRef.current) stopRecording();
        
        // [FIX] 전이 시점에 즉시 Ref를 설정하여 IDLE 전환 가드를 활성화
        if (event.previousStage === InterviewStage.SELF_INTRO && !pendingAiPlaybackRef.current) {
          pendingFirstQuestionRef.current = true;
        }
      }

      const leadRole = resolveLeadRole(interviewMeta?.participatingPersonas);

      if (nextStage === InterviewStage.GREETING) {
        setTimeout(() => {
          const audioPath = getStaticAudioPath("greeting", "greeting", leadRole);
          ttsQueueRef.current.push({
            sentenceIndex: -1,
            localPath: audioPath,
            persona: leadRole,
            text: "안녕하세요 면접자님 만나서 반갑습니다.",
          });
          playNextTts();
        }, 1000);
      } else if (nextStage === InterviewStage.CANDIDATE_GREETING) {
        setPendingAiPlayback(false);
      } else if (nextStage === InterviewStage.SELF_INTRO) {
        setPendingAiPlayback(false);
        selfIntroTimerExpiredRef.current = false;
        stageStartTimeRef.current = Date.now();
        setTimeLeft(TURN_POLICY.SELF_INTRO_HARD_TIMEOUT_SEC);
        setShowSelfIntroGuide(true);
        setTimeout(() => setShowSelfIntroGuide(false), 3000);
      } else if (nextStage === InterviewStage.IN_PROGRESS) {
        setTimeLeft(null);
        if (event.previousStage === InterviewStage.SELF_INTRO) {
          // [FIX] 만약 이미 LLM 토큰이 수신되기 시작했다면 가드를 적용하지 않습니다. (레이스 컨디션 방지)
          if (!pendingAiPlaybackRef.current) {
            pendingFirstQuestionRef.current = true;
          }
          
          // [FIX] 전이 시점에 큐에 쌓여있던 안내/리트라이(sentenceIndex: -1) 메시지만 제거
          // LLM에서 이미 수신한 본 면접 질문(sentenceIndex >= 0)은 보존합니다.
          ttsQueueRef.current = ttsQueueRef.current.filter(item => (item.sentenceIndex ?? -1) >= 0);
          
          const isSuccessfulIntro = true;
          const transitionText = "좋습니다. 자기소개 잘 들었습니다. 이제 본격적으로 면접을 시작하겠습니다.";

          const transitionPath = getStaticAudioPath(
            "guide",
            isSuccessfulIntro ? "transition_intro" : "intervene_intro",
            leadRole,
          );

          ttsQueueRef.current.push({
            sentenceIndex: -1,
            localPath: transitionPath,
            persona: leadRole,
            text: transitionText,
          });
          playNextTts();
        }
      } else if (nextStage === InterviewStage.INTERVIEWER_INTRO) {
        ttsQueueRef.current.push({
          sentenceIndex: -1,
          localPath: getStaticAudioPath("prompt", "interviewer_intro", leadRole),
          persona: leadRole,
          text: "네 반갑습니다. 지금부터 참여해주신 면접관님들께서 간단한 자기소개를 진행해주시겠습니다.",
        });

        const personas = interviewMeta?.participatingPersonas || [leadRole];
        personas.forEach((p) => {
          const introText = p === ("MAIN" as InterviewPersona) ? "안녕하세요. 저는 리드 면접관입니다. 오늘 전체적인 면접 흐름을 이끌어갈 예정입니다."
            : p === "HR" ? "안녕하세요. 저는 인사 부문을 담당하고 있는 면접관입니다. 조직 문화와 가치관 적합성을 집중적으로 확인하겠습니다."
            : p === "TECH" ? "안녕하세요. 저는 기술 면접관입니다. 실무 역량과 기술적 깊이를 위주로 대화를 나누고 싶습니다."
            : p === "EXEC" ? "안녕하세요. 저는 임원 면접관입니다. 비즈니스 통찰력과 장기적인 성장 가능성을 검토하도록 하겠습니다."
            : "안녕하세요. 저는 면접관입니다. 잘 부탁드립니다.";

          ttsQueueRef.current.push({
            sentenceIndex: -1,
            localPath: getStaticAudioPath("prompt", "intro_self", p),
            persona: p,
            text: introText,
          });
        });

        playNextTts();
      } else if (nextStage === InterviewStage.SELF_INTRO_PROMPT) {
        ttsQueueRef.current.push({
          sentenceIndex: -1,
          localPath: getStaticAudioPath("prompt", "self_intro", leadRole),
          persona: leadRole,
          text: "지금부터 약 1분간 자기소개를 진행 부탁드립니다.",
        });
        playNextTts();
      } else if (nextStage === InterviewStage.LAST_ANSWER) {
        setPendingAiPlayback(false);
      }

      const allowedStages = [
        InterviewStage.CANDIDATE_GREETING,
        InterviewStage.SELF_INTRO,
        InterviewStage.IN_PROGRESS,
        InterviewStage.LAST_ANSWER,
      ];
      if (!allowedStages.includes(nextStage)) {
        if (recordingRef.current) stopRecording();
        setIsUserSpeaking(false);
      }
    });

    setOnIntervene((e: InterveneEvent) => {
      setIntervention(e.message);
      setTimeout(() => setIntervention(null), 5000);
      if (recording) stopRecording();

      const leadRole =
        interviewMeta?.participatingPersonas?.find((persona) => persona === "LEADER") ||
        interviewMeta?.participatingPersonas?.[0] ||
        "LEADER";
      if (id) {
        socket?.emit("interview:system_message", {
          interviewId: id,
          content: e.message,
          stage: currentStageRef.current,
          personaId: leadRole,
          turnCount: turnCountRef.current,
          sequenceNumber: 0,
        });
      }
    });

    setOnStt((data) => {
      if (data.isFinal && data.text) {
        setSubtitle(data.text);
        setSttHistory((prev) => [data.text, ...prev].slice(0, 5));
      }
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = setTimeout(() => setSubtitle(null), 3000);
    });

    return () => {
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    };
  }, [
    setOnTurnState,
    setOnStageChanged,
    setOnIntervene,
    setOnStt,
    setOnRetryAnswer,
    interviewMeta,
    recording,
    stopRecording,
    manualPaused,
    connected,
    id,
    notifyStageReady,
    playNextTts,
    socket,
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
      // setRetryCount(0); // [REMOVED]
      return;
    }
    if (!micOn || manualPaused || ttsPlaying || pendingAiPlayback) return;
    if (!turnState?.canCandidateSpeak) return;
    
    // [FIX] 서버의 turnState가 클라이언트의 currentStage와 일치할 때만 녹음 시작 허용 (Race Condition 방어)
    if (turnState.stage !== currentStage) {
        if (import.meta.env.DEV) console.log(`Step-Sync Guard: turnState.stage(${turnState.stage}) !== currentStage(${currentStage})`);
        return;
    }

    if (pendingAiPlayback || pendingFirstQuestionRef.current) return;
    if (
      currentStage === InterviewStage.SELF_INTRO &&
      selfIntroTimerExpiredRef.current
    ) {
      return;
    }
    if (!recording) {
      // [FIX] 인사 단계는 사용자의 가벼운 인사를 수용하기 위해 여유를 둠 (400ms -> 1000ms)
      const redemptionMs = (currentStageRef.current === InterviewStage.CANDIDATE_GREETING) ? 1000 
        : (currentStageRef.current === InterviewStage.SELF_INTRO) ? 3000 
        : 1500;
      startRecording(undefined, redemptionMs);
      setConversationState("LISTENING");
    }
  }, [connected, currentStage, manualPaused, micOn, recording, startRecording, turnState, ttsPlaying, pendingFirstQuestionRef.current, pendingAiPlayback]);


  useEffect(() => {
    let interval: any;
    if (
      currentStage === InterviewStage.SELF_INTRO &&
      timeLeft !== null &&
      timeLeft > 0
    ) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            selfIntroTimerExpiredRef.current = true;
            console.log("SELF_INTRO timeout. recording=", recordingRef.current);
            if (recordingRef.current) {
              // VAD가 아직 실행 중이면 정상 종료
              stopRecording();
            } else {
              socket?.emit("interview:text_input", {
                interviewId: id,
                text: "(자기소개 시간 초과)",
              });
            }
            // null로 반환하여 타이머 관련 컴포넌트를 즉시 숨김 (0 반환 시 timeLeft !== null 조건이 남아 잔류)
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStage, timeLeft, stopRecording, socket, id]);

  // E2E 테스트 훅 (window.__E2E_MODE가 설정된 경우에만 동작, 프로덕션 무해)
  useEffect(() => {
    if (!(window as any).__E2E_MODE) return;
    (window as any).__currentInterviewStage = currentStage;
  }, [currentStage]);

  useEffect(() => {
    if (!(window as any).__E2E_MODE) return;
    (window as any).__socketConnected = connected;
  }, [connected, sttHistory]);

  // [FIX] 컴포넌트 언마운트(화면 이탈) 시 모든 오디오 재생 및 녹음 중단
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        console.log("Unmounting: Stopping recording...");
        stopRecording();
      }
      if (currentTtsAudioRef.current) {
        console.log("Unmounting: Stopping audio playback...");
        currentTtsAudioRef.current.pause();
        currentTtsAudioRef.current.src = "";
      }
      ttsQueueRef.current = [];
      setTtsPlaying(false);
    };
  }, []);

  useEffect(() => {
    if (!(window as any).__E2E_MODE) return;
    (window as any).__e2eIsRecording = recording;
    (window as any).__e2eStopRecording = () => {
      if (recording) stopRecording();
    };
  }, [recording, stopRecording]);

  if (id == null)
    return <div className={styles.wrap}>유효하지 않은 인터뷰입니다.</div>;

  const selectedRoles = interviewMeta?.participatingPersonas || [
    "TECH" as InterviewPersona,
  ];

  const PERSONA_UI_MAP: Record<
    string,
    { label: string; icon: string; color: string }
  > = {
    TECH: { label: "기술 면접관", icon: "💻", color: "#60a5fa" },
    HR: { label: "인사 면접관", icon: "🤝", color: "#34d399" },
    LEADER: { label: "리드 면접관", icon: "👨‍💼", color: "#f59e0b" },
    EXEC: { label: "임원 면접관", icon: "◈", color: "#ec4899" },
    PRESSURE: { label: "압박 면접관", icon: "⚡", color: "#f87171" },
    COMFORTABLE: { label: "편안한 면접관", icon: "😊", color: "#10b981" },
    RANDOM: { label: "랜덤 면접관", icon: "🎲", color: "#8b5cf6" },
  };

  // [NEW] Effective State: 클라이언트 로컬 재생 상태를 반영한 최종 UI 상태
  const effectiveStatus = (pendingAiPlayback || ttsPlaying) ? "SPEAKING" : conversationState;

  return (
    <div className={styles.wrap}>
      {/* ... (connected overlay remains same) */}
      <div className={styles.infoOverlay}>
        <div className={styles.sessionInfo}>
          <span className={styles.timerBadge}>
            {import.meta.env.DEV
              ? effectiveStatus === "LISTENING"
                ? "Listening..."
                : effectiveStatus
              : connected
                ? "On-Air"
                : "Disconnected"}
          </span>
          {import.meta.env.DEV && (
            <>
              {currentPersonaId && (
                <>
                  <span className={styles.divider}>|</span>
                  <span className={styles.interviewerBadge}>
                    면접관:{" "}
                    {PERSONA_UI_MAP[currentPersonaId as InterviewPersona]?.label ||
                      currentPersonaId}
                  </span>
                </>
              )}
              {thinking && 
               !["GREETING", "CANDIDATE_GREETING", "INTERVIEWER_INTRO", "SELF_INTRO_PROMPT"].includes(currentStage) && (
                <>
                  <span className={styles.divider}>|</span>
                  <span className={styles.thinkingBadge}>Thinking...</span>
                </>
              )}
            </>
          )}
          {elapsedSeconds > 0 && (
            <>
              <span className={styles.divider}>|</span>
              <span className={styles.timerBadge}>
                ⏱️ {formatTime(elapsedSeconds)}
              </span>
            </>
          )}
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
          {import.meta.env.DEV && (
            <span
              className={styles.connectionDot}
              style={{ background: connected ? "#34d399" : "#fbbf24" }}
            />
          )}
        </div>
        {(error || micError) && (
          <div className={styles.errorBanner}>{error || micError}</div>
        )}

        {timeReducedToast && (
          <div className={styles.toastNotification}>
            <span>
              ⏱️ 인터뷰 시간이 단축되었습니다. 핵심만 간결하게 답변해주세요.
            </span>
          </div>
        )}

        {import.meta.env.DEV && (
          <div className={styles.stageIndicator}>
            <div className={styles.stageStatus}>
              <span className={styles.stageLabel}>진행 단계</span>
              <span className={styles.stageValue}>{currentStage}</span>
            </div>
            {currentStage === InterviewStage.SELF_INTRO && timeLeft !== null && (
              <div className={styles.stageTimer}>
                <span className={styles.timerLabel}>자기소개 시간</span>
                <span className={styles.timerValue}>
                  {Math.floor(timeLeft / 60)}:
                  {(timeLeft % 60).toString().padStart(2, "0")}
                </span>
              </div>
            )}
            {currentStage === InterviewStage.SELF_INTRO && timeLeft !== null && (
              <button
                className={styles.skipBtn}
                onClick={() => {
                  if (recording) stopRecording();
                  socket?.emit("interview:skip_stage", {
                    interviewId: id,
                    currentStage: InterviewStage.SELF_INTRO,
                  });
                }}
              >
                건너뛰기 ⏭️
              </button>
            )}
          </div>
        )}
      </div>

      {intervention && (
        <div
          className={styles.interventionOverlay}
          onClick={() => setIntervention(null)}
          style={{ cursor: "pointer" }}
        >
          <div className={styles.interventionContent}>
            <div className={styles.interventionHeader}>
              <span className={styles.interventionIcon}>💡</span>
              <span className={styles.interventionTitle}>면접관 개입</span>
            </div>
            <p className={styles.interventionMessage}>{intervention}</p>
            <span
              style={{
                fontSize: "0.8em",
                color: "#666",
                marginTop: "10px",
                display: "block",
              }}
            >
              (클릭하여 닫기)
            </span>
          </div>
        </div>
      )}

      {/* COMPLETED 단계 안내 Overlay */}
      {currentStage === InterviewStage.COMPLETED && (
        <div
          className={styles.interventionOverlay}
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
        >
          <div className={styles.interventionContent}>
            <div className={styles.interventionHeader}>
              <span className={styles.interventionIcon}>🏁</span>
              <span className={styles.interventionTitle}>면접 종료</span>
            </div>
            <p className={styles.interventionMessage}>
              수고하셨습니다! 모든 면접 과정이 완료되었습니다.
              <br />
              <span style={{ fontSize: "0.9em", color: "#666" }}>
                아래 버튼을 눌러 면접을 종료하고 나갈 수 있습니다.
              </span>
            </p>
            <button
              className={styles.primaryBtn}
              onClick={() => navigate("/")}
              style={{ marginTop: "1.5rem", width: "100%" }}
            >
              면접 나가기
            </button>
          </div>
        </div>
      )}

      {/* CANDIDATE_GREETING 단계 안내 Overlay */}
      {currentStage === InterviewStage.CANDIDATE_GREETING && (
        <div className={styles.interventionOverlay}>
          <div className={styles.interventionContent}>
            <div className={styles.interventionHeader}>
              <span className={styles.interventionIcon}>👋</span>
              <span className={styles.interventionTitle}>면접 시작</span>
            </div>
            <p className={styles.interventionMessage}>
              면접관에게 가볍게 인사해주세요!
              <br />
              <span style={{ fontSize: "0.9em", color: "#666" }}>
                (예: "안녕하세요!")
              </span>
            </p>
          </div>
        </div>
      )}

      {/* SELF_INTRO 단계 안내 팝업 (3초 자동 dismiss) */}
      {showSelfIntroGuide && currentStage === InterviewStage.SELF_INTRO && (
        <div
          className={styles.interventionOverlay}
          onClick={() => setShowSelfIntroGuide(false)}
          style={{ cursor: "pointer" }}
        >
          <div className={styles.interventionContent}>
            <div className={styles.interventionHeader}>
              <span className={styles.interventionIcon}>🎤</span>
              <span className={styles.interventionTitle}>자기소개</span>
            </div>
            <p className={styles.interventionMessage}>
              1분 30초 이내로 자기소개를 해주세요!
              <br />
              <span style={{ fontSize: "0.9em", color: "#888" }}>
                (30초 미만은 재시도 요청이 올 수 있습니다)
              </span>
            </p>
            <span
              style={{
                fontSize: "0.8em",
                color: "#666",
                marginTop: "10px",
                display: "block",
              }}
            >
              (클릭하여 닫기)
            </span>
          </div>
        </div>
      )}

      {/* 자기소개 타이머 테두리 효과 */}
      {currentStage === InterviewStage.SELF_INTRO && timeLeft !== null && (
        <div
          className={styles.timerOverlay}
          style={
            {
              "--timer-color":
                timeLeft > 60
                  ? "#3b82f6" // 0~30초 (기본 90초 시작 기준 역산) -> 실제 계산 로직 적용
                  : timeLeft > 30
                    ? "#34d399"
                    : "#ef4444",
            } as React.CSSProperties
          }
        />
      )}

      {subtitle && (
        <div className={styles.subtitleOverlay}>
          <span className={styles.subtitleText}>{subtitle}</span>
        </div>
      )}


      {enableTextInput && (
        <div className={styles.textInputArea}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="답변을 입력하세요... (Enter 키로 전송)"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                handleSendText();
              }
            }}
            disabled={effectiveStatus !== "LISTENING" && effectiveStatus !== "IDLE"}
          />
          <button 
            className={styles.sendBtn}
            onClick={() => handleSendText()}
            disabled={!typedText.trim() || (effectiveStatus !== "LISTENING" && effectiveStatus !== "IDLE")}
          >
            전송
          </button>
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

          {selectedRoles.map((roleId, idx) => {
            const roleUI = PERSONA_UI_MAP[roleId] || PERSONA_UI_MAP.TECH;

            // Highlight if backend sent this roleId OR if only 1 interviewer exists
            // [FIX] 실효 상태(effectiveStatus)를 기준으로 하이라이트 여부 결정
            const isThisInterviewerSpeaking =
              (effectiveStatus === "SPEAKING") &&
              (currentPersonaId === roleId || selectedRoles.length === 1);

            return (
              <div
                key={`interviewer-${idx}-${roleId}`}
                className={`${styles.interviewerTile} ${isThisInterviewerSpeaking ? styles.speaking : ""} ${roleId === "LEADER" ? styles.leaderTile : ""}`}
                style={{
                  borderColor: isThisInterviewerSpeaking
                    ? roleUI.color
                    : "transparent",
                  transition: "border-color 0.2s",
                }}
              >
                <div className={styles.tileHeader}>
                  <span className={styles.tileLabel}>면접관 {idx + 1}</span>
                  <span
                    className={styles.roleBadge}
                    style={{
                      backgroundColor: roleUI.color + "22",
                      color: roleUI.color,
                    }}
                  >
                    {roleUI.label}
                  </span>
                </div>
                <div className={styles.interviewerAvatar}>
                  {!interviewersJoined ? (
                    <div className={styles.joiningMessage}>
                      면접관이 입장하고 있습니다...
                    </div>
                  ) : (
                    <>
                      <div
                        className={styles.avatarCircle}
                        style={{ backgroundColor: roleUI.color }}
                      >
                        {roleUI.icon}
                      </div>
                      <div className={styles.interviewerName}>
                        {roleUI.label}
                      </div>
                      {thinking && isThisInterviewerSpeaking && (
                        <div className={styles.thinkingBubble}>Thinking...</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
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

              {/* Accessibility Section */}
              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>접근성</h3>
                
                <div className={styles.toggleField}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>자막 표시</span>
                    <span className={styles.toggleDesc}>면접 질문 및 내 답변을 자막으로 봅니다.</span>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={showSubtitles} 
                      onChange={(e) => {
                        const val = e.target.checked;
                        setShowSubtitles(val);
                        localStorage.setItem("interview_show_subtitles", String(val));
                      }} 
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.toggleField}>
                  <div className={styles.toggleLabel}>
                    <span className={styles.toggleTitle}>텍스트 입력 사용</span>
                    <span className={styles.toggleDesc}>음성 대신 텍스트로 답변을 작성할 수 있습니다.</span>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={enableTextInput} 
                      onChange={(e) => {
                        const val = e.target.checked;
                        setEnableTextInput(val);
                        localStorage.setItem("interview_enable_text_input", String(val));
                      }} 
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
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
          <button type="button" onClick={handleExit} className={styles.exitBtn}>
            나가기
          </button>
        </div>
      </footer>

      {/* DevTool Panel (개발 환경 전용) */}
      {import.meta.env.DEV && interviewId && (
        <DevToolPanel
          interviewId={interviewId}
          setOnDebugTrace={setOnDebugTrace}
          joinDebugTrace={joinDebugTrace}
          isTraceJoined={isTraceJoined}
          socket={socket}
          debugInfo={{
            currentStage,
            conversationState,
            ttsQueueCount: ttsQueueRef.current.length,
            ttsQueueItems: ttsQueueRef.current.map((item) => ({
              text:
                item.text ||
                (item.localPath
                  ? `GUIDE: ${item.localPath.split("/").pop()}`
                  : "Streaming Audio..."),
              isLocal: !!item.localPath,
            })),
            sttHistory: sttHistory,
            thinking,
            connected,
          }}
        />
      )}
    </div>
  );
}
