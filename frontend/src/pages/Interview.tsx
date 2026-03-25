import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  useInterviewSocket,
  InterviewStage,
  type StageChangedEvent,
  type InterveneEvent,
} from "@/hooks/useInterviewSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useInterviewProtection } from "@/hooks/useInterviewProtection";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { DevToolPanel } from "@/components/DevTool/DevToolPanel";
import type {
  InterviewPersona,
  InterviewType,
  InterviewPersonality,
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
  personality: InterviewPersonality;
  interviewerCount: number;
  type: InterviewType;
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
  engine: string,
) {
  if (action === "interviewer_intro") {
    return `/audio/${category}/${action}_${persona}.mp3`;
  }
  return `/audio/${category}/${action}_${persona}_${engine}.mp3`;
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
  const [videoError, setVideoError] = useState("");
  const [conversationState, setConversationState] =
    useState<ConversationState>("IDLE");
  const [manualPaused, setManualPaused] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTtsAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAllAudio = useCallback(() => {
    // 2. Stop current dynamic TTS audio
    if (currentTtsAudioRef.current) {
      currentTtsAudioRef.current.pause();
      currentTtsAudioRef.current.src = "";
      currentTtsAudioRef.current = null;
    }

    // 3. Clear queue and reset states
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
  const onLevelRef = useRef<(level: number, ts: number) => void>(() => {});

  // Media Control State
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const turnEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stageReadyCalledRef = useRef<string | null>(null); // 중복 트리거 방지 플래그 추가
  const pendingStageAudioRef = useRef<TtsChunk | null>(null); // STAGE_CHANGE 오디오 지연 재생용

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
    setOnIntervene,
    setOnRetryAnswer,
    setOnResumeProcessed,
    socket,
  } = useInterviewSocket(id);

  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  const [currentStage, setCurrentStage] = useState<InterviewStage>(
    InterviewStage.WAITING,
  );
  const [intervention, setIntervention] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [currentPersonaId, setCurrentPersonaId] = useState<string | null>(null); // New State
  const [timeReducedToast, setTimeReducedToast] = useState(false);
  const [showSelfIntroGuide, setShowSelfIntroGuide] = useState(false);
  const [sttHistory, setSttHistory] = useState<string[]>([]); // New State
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // Elapsed timer

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
  const isStoppingRef = useRef(false);
  const recordingRef = useRef(false);

  // 3-Layer Defense System
  const isInterviewActive =
    currentStage !== InterviewStage.WAITING &&
    currentStage !== InterviewStage.COMPLETED;

  const handlePauseInterview = useCallback(async () => {
    if (!id) return;
    // 진행 중인 상태(IN_PROGRESS 등)가 아닐 때는 일시정지 요청 생략 (Core 500 하위호환 에러 방지)
    if (
      currentStage === InterviewStage.WAITING ||
      currentStage === InterviewStage.GREETING ||
      currentStage === InterviewStage.CANDIDATE_GREETING
    ) {
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
    }
  }, [id, currentStage]);

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
      // AI가 말하고 있거나 대기 중일 때는 프론트엔드에서도 오디오 전송을 원천 차단
      if (conversationState !== "LISTENING") {
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
    },
  );

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const finalizeStreamingMessage = useCallback(() => {
    streamBufRef.current = "";
  }, []);

  // Socket Handler Updates
  useEffect(() => {
    setOnTranscript((tokenData) => {
      // Handle standard token
      if (tokenData.token) {
        appendStreamRef.current(tokenData.token);
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
    });

    setOnResumeProcessed((e) => {
      console.log("Resume processed notification received:", e);
      if (e.status === "COMPLETED") {
        setSubtitle("이력서 분석이 완료되었습니다. 면접 질문에 반영됩니다.");
        // 5초 뒤에 자막 제거
        if (subtitleTimeoutRef.current)
          clearTimeout(subtitleTimeoutRef.current);
        subtitleTimeoutRef.current = setTimeout(() => setSubtitle(null), 5000);
      }
    });
  }, [setOnTranscript, setOnResumeProcessed]);

  const stopRecording = useCallback(() => {
    if (!recording || isStoppingRef.current) return;
    isStoppingRef.current = true;

    stop(); // Stop recording via hook

    setIsUserSpeaking(false);

    sendFinal(); // 정상 종료 시 Final chunk 전송

    setThinking(null);
    setConversationState("PROCESSING");
    finalizeStreamingMessage();
    hasSpeechRef.current = false;
    speechStartTsRef.current = null;
    silenceStartTsRef.current = null;

    // 약간의 지연 후 중복 방지 해제 (또는 다음 녹음 시작 시 해제)
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 1000);
  }, [recording, stop, sendFinal, finalizeStreamingMessage]);

  const startRecording = useCallback(async () => {
    if (recording || manualPaused) return;
    isStoppingRef.current = false; // 녹음 시작 시 중단 방지 초기화
    hasSpeechRef.current = false;
    speechStartTsRef.current = null;
    silenceStartTsRef.current = null;
    await start(selectedMicrophone || undefined);
    setConversationState("LISTENING");
  }, [manualPaused, recording, start, selectedMicrophone]);

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
      console.log("Timer sync received:", payload);
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
  }, [id, location.state, initVideo, stop, stopAllAudio]);

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
      const SPEECH_START_THRESHOLD = 0.05;
      const SPEECH_END_THRESHOLD = 0.035;
      // 자기소개 단계에서는 침묵 감지 기준을 3초로 늘림 (생각할 시간 부여)
      const SILENCE_DURATION_MS =
        currentStageRef.current === InterviewStage.SELF_INTRO ? 3500 : 1500;
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
  const stageStartTimeRef = useRef(Date.now()); // 스테이지 시작 시간 기록

  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

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
      // [Barge-in 차단] AI 발화 중에는 녹음을 멈추기만 하고, 발화 중단을 허용하지 않음
      if (recording) stop(); // recording hook의 stop만 호출하여 마이크 끔

      setConversationState("SPEAKING");
      setIsInterviewerSpeaking(true);

      const cleanup = () => {
        ttsPlayingRef.current = false;
        setIsInterviewerSpeaking(false);
        playNextTts();
      };

      try {
        let audio: HTMLAudioElement;
        let url = "";

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

    // 3. Queue is EMPTY -> Schedule "Turn End" Debounce
    if (turnEndTimeoutRef.current) return;

    turnEndTimeoutRef.current = setTimeout(() => {
      turnEndTimeoutRef.current = null;
      if (ttsQueueRef.current.length > 0) {
        playNextTts();
        return;
      }

      console.log("Turn Ended. Stage:", currentStageRef.current);

      const allowedStages = [
        InterviewStage.GREETING,
        InterviewStage.INTERVIEWER_INTRO,
        InterviewStage.SELF_INTRO_PROMPT,
        InterviewStage.CANDIDATE_GREETING,
        InterviewStage.SELF_INTRO,
        InterviewStage.IN_PROGRESS,
        InterviewStage.LAST_ANSWER,
        InterviewStage.CLOSING_GREETING,
        InterviewStage.LAST_QUESTION_PROMPT,
      ];

      if (
        !manualPaused &&
        connected &&
        allowedStages.includes(currentStageRef.current)
      ) {
        startRecording().catch(console.error);
      } else {
        setConversationState("IDLE");
      }

      const stagesRequiringReady = [
        InterviewStage.GREETING,
        InterviewStage.SELF_INTRO_PROMPT,
        InterviewStage.LAST_QUESTION_PROMPT,
      ];

      if (
        stagesRequiringReady.includes(currentStageRef.current) &&
        ttsQueueRef.current.length === 0 &&
        stageReadyCalledRef.current !== currentStageRef.current // 이미 호출된 경우 차단
      ) {
        stageReadyCalledRef.current = currentStageRef.current;
        notifyStageReady(currentStageRef.current);
      }
    }, 1500);
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
      if (recording) stop(); // AI 발화 시작 시 녹음 중단 (마이크 끔)
      setTimeLeft(90); // 30초 미만이라 재시도일 때, 새롭게 90초 타이머 리셋

      const personaKey = interviewMeta?.personality || "COMFORTABLE";
      const engineKey = interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
      // FIX: Use `retry_short` instead of `please_repeat` (which sounds like "Sorry...")
      const audioPath = getAudioPath(
        "feedback",
        "retry_short",
        personaKey,
        engineKey,
      );

      // Show toast for visual feedback
      setIntervention(
        "답변이 너무 짧습니다. 조금 더 길게 말씀해주세요. (30초 이상)",
      );
      setTimeout(() => setIntervention(null), 5000);

      ttsQueueRef.current.push({
        sentenceIndex: -1,
        localPath: audioPath,
        persona: personaKey,
      });
      playNextTts();
    });

    setOnStageChanged((e: StageChangedEvent) => {
      console.log(`Stage changed: ${e.previousStage} -> ${e.currentStage}`);
      setCurrentStage(e.currentStage);

      // [중복 오디오 방지] 정적 오디오 파일이 재생될 단계 전체에 잠금 가이드 적용
      const stagesWithStaticAudio = [
        InterviewStage.GREETING,
        InterviewStage.SELF_INTRO_PROMPT,
        InterviewStage.LAST_QUESTION_PROMPT,
      ];

      if (stagesWithStaticAudio.includes(e.currentStage)) {
        if (stageReadyCalledRef.current === "AUDIO_PLAYED_" + e.currentStage) {
          return;
        }
        stageReadyCalledRef.current = "AUDIO_PLAYED_" + e.currentStage;
      }

      if (e.currentStage === InterviewStage.GREETING) {
        // 면접관 인사 음성 재생 (리드 면접관 or 첫 번째 역할 기준)
        setTimeout(() => {
          const personaKey = interviewMeta?.personality || "COMFORTABLE";
          const activeRole =
            interviewMeta?.participatingPersonas?.[0] || ("TECH" as InterviewPersona);
          const audioPath = getAudioPath(
            "greeting",
            "greeting",
            personaKey,
            "edge",
          );

          ttsQueueRef.current.push({
            sentenceIndex: -1,
            localPath: audioPath,
            persona: activeRole,
          });
          playNextTts();
        }, 1500);
      } else if (e.currentStage === InterviewStage.CANDIDATE_GREETING) {
        // 지원자 인사 단계: 녹음 시작 (이미 playNextTts의 turnEndTimeout에서 처리되지만 안전하게 유지)
        if (!manualPaused && connected) {
          startRecording();
        }
      } else if (e.currentStage === InterviewStage.SELF_INTRO) {
        // SELF_INTRO 시작
        stageStartTimeRef.current = Date.now();
        setTimeLeft(90);
        // 자기소개 안내 팝업 표시 (3초 후 자동 dismiss)
        setShowSelfIntroGuide(true);
        setTimeout(() => setShowSelfIntroGuide(false), 3000);
        if (!manualPaused && connected) {
          startRecording();
        }
      } else if (e.currentStage === InterviewStage.IN_PROGRESS) {
        setTimeLeft(null);

        // SELF_INTRO -> IN_PROGRESS 전환 시 Transition Audio 재생 (조건부)
        // 1. Intervention 직후 (previousStage === SELF_INTRO && intervention !== null)
        // 2. Intervention 없이 자연스럽게 넘어간 경우 (previousStage === SELF_INTRO)
        // 둘 다 안내 멘트 필요함.

        if (e.previousStage === InterviewStage.SELF_INTRO) {
          const personaKey = interviewMeta?.personality || "COMFORTABLE";
          const activeRole =
            interviewMeta?.participatingPersonas?.[0] || ("TECH" as InterviewPersona);
          const transitionPath = getAudioPath(
            "guide",
            "transition_intro",
            personaKey,
            "edge",
          );

          ttsQueueRef.current.push({
            sentenceIndex: -1,
            localPath: transitionPath,
            persona: activeRole,
          });
          playNextTts();
        }
      } else if (e.currentStage === InterviewStage.INTERVIEWER_INTRO) {
        // 면접관 소개 단계: LLM 스트리밍(TTS)을 통해 각 면접관이 순차적으로 자기소개함.
        console.log("Waiting for interviewer self-introductions...");
      } else if (e.currentStage === InterviewStage.SELF_INTRO_PROMPT) {
        // 1분 자기소개 요청 음성 재생 (사전 녹음)
        const personaKey = interviewMeta?.personality || "RANDOM";
        const activeRole =
          interviewMeta?.participatingPersonas?.[0] || ("TECH" as InterviewPersona);
        const engineKey =
          interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
        const audioPath = getAudioPath(
          "prompt",
          "self_intro_prompt",
          personaKey,
          engineKey,
        );

        const chunk: TtsChunk = {
          sentenceIndex: -1,
          localPath: audioPath,
          persona: activeRole,
        };

        // TTS 재생 중이거나 큐에 항목이 있으면 지연 재생 (STAGE_CHANGE가 TTS 오디오보다 먼저 도착하는 레이스 컨디션 방지)
        if (ttsPlayingRef.current || ttsQueueRef.current.length > 0) {
          pendingStageAudioRef.current = chunk;
        } else {
          ttsQueueRef.current.push(chunk);
          playNextTts();
        }
      } else if (e.currentStage === InterviewStage.LAST_QUESTION_PROMPT) {
        // 마지막 질문 안내 음성 재생 (사전 녹음)
        const personaKey = interviewMeta?.personality || "RANDOM";
        const activeRole =
          interviewMeta?.participatingPersonas?.[0] || ("TECH" as InterviewPersona);
        const engineKey =
          interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
        const audioPath = getAudioPath(
          "prompt",
          "last_question_prompt",
          personaKey,
          engineKey,
        );

        ttsQueueRef.current.push({
          sentenceIndex: -1,
          localPath: audioPath,
          persona: activeRole,
        });
        playNextTts();
      } else if (e.currentStage === InterviewStage.LAST_ANSWER) {
        // 마지막 답변 단계: 녹음 시작
        if (!manualPaused && connected) {
          startRecording();
        }
      } else if (e.currentStage === InterviewStage.CLOSING_GREETING) {
        // Java triggerClosingGreeting()이 LLM 기반 작별 인사 TTS를 생성하므로
        // 정적 오디오 없이 LLM TTS만 재생됨. 녹음은 TTS 완료 후 turnEndTimeout에서 자동 시작.
      }
    });

    setOnIntervene((e: InterveneEvent) => {
      console.log(`Intervention received: ${e.message}`);
      setIntervention(e.message);

      // Auto-dismiss after 5 seconds
      setTimeout(() => setIntervention(null), 5000);

      if (recording) stop(); // AI 개입 시작 시 녹음 중단

      const personaKey = interviewMeta?.personality || "RANDOM";
      const audioPath = getAudioPath(
        "guide",
        "intervene_intro",
        personaKey,
        "edge",
      );

      ttsQueueRef.current.push({
        sentenceIndex: -1,
        localPath: audioPath,
        persona: personaKey,
        text: e.message, // 메시지 자막용
      });
      playNextTts();
    });

    setOnStt((data) => {
      console.log("STT segment:", data);
      if (data.isFinal && data.text) {
        setSubtitle(data.text);
        setSttHistory((prev) => [data.text, ...prev].slice(0, 5));
      }
      if (subtitleTimeoutRef.current) {
        clearTimeout(subtitleTimeoutRef.current);
      }

      subtitleTimeoutRef.current = setTimeout(() => {
        setSubtitle(null);
      }, 3000);
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
      InterviewStage.CANDIDATE_GREETING,
      InterviewStage.SELF_INTRO,
      InterviewStage.IN_PROGRESS,
      InterviewStage.LAST_ANSWER,
    ];
    if (!recording && autoRecordStages.includes(currentStage)) {
      startRecording();
    }
  }, [connected, manualPaused, recording, startRecording, micOn, currentStage]);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

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
            console.log("SELF_INTRO timeout. recording=", recordingRef.current);
            if (recordingRef.current) {
              // VAD가 아직 실행 중이면 정상 종료
              stopRecording();
            } else {
              // VAD가 이미 녹음을 멈춘 상태 → 백엔드에 스킵 신호 전송
              socket?.emit("interview:skip_stage", {
                interviewId: id,
                currentStage: InterviewStage.SELF_INTRO,
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
    PRESSURE: { label: "압박 면접관", icon: "⚡", color: "#f87171" },
    COMFORTABLE: { label: "편안한 면접관", icon: "😊", color: "#10b981" },
    RANDOM: { label: "랜덤 면접관", icon: "🎲", color: "#8b5cf6" },
  };

  return (
    <div className={styles.wrap}>
      {/* ... (connected overlay remains same) */}
      <div className={styles.infoOverlay}>
        <div className={styles.sessionInfo}>
          <span className={styles.timerBadge}>
            {conversationState === "LISTENING"
              ? "Listening..."
              : conversationState}
          </span>
          {interviewMeta?.personality && (
            <>
              <span className={styles.divider}>|</span>
              <span className={styles.personalityBadge}>
                분위기:{" "}
                {
                  PERSONA_UI_MAP[interviewMeta.personality as InterviewPersona]
                    ?.label
                }
              </span>
            </>
          )}
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
          {thinking && (
            <>
              <span className={styles.divider}>|</span>
              <span className={styles.thinkingBadge}>Thinking...</span>
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
          <span
            className={styles.connectionDot}
            style={{ background: connected ? "#34d399" : "#fbbf24" }}
          />
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
                (예: "안녕하세요, 잘 부탁드립니다.")
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
            const isThisInterviewerSpeaking =
              isInterviewerSpeaking &&
              (currentPersonaId === roleId || selectedRoles.length === 1);

            return (
              <div
                key={`interviewer-${idx}-${roleId}`}
                className={`${styles.interviewerTile} ${isThisInterviewerSpeaking ? styles.speaking : ""}`}
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
      {interviewId && (
        <DevToolPanel
          interviewId={interviewId}
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
