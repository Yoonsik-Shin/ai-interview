import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import {
  useInterviewSocket,
  InterviewStage,
  type StageChangedEvent,
  type InterveneEvent,
} from "@/hooks/useInterviewSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import type {
  InterviewPersona,
  InterviewType,
  InterviewRole,
  InterviewPersonality,
} from "@/api/interview";
import styles from "./Interview.module.css";

type TtsChunk = { sentenceIndex: number; audioData: string; duration?: number };

type InterviewMeta = {
  interviewerRoles?: InterviewRole[];
  personality: InterviewPersonality;
  interviewerCount: number;
  type: InterviewType;
  domain: string;
  targetDurationMinutes: number;
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
  const streamBufRef = useRef("");
  const appendStreamRef = useRef<(token: string) => void>(() => {});
  const ttsQueueRef = useRef<TtsChunk[]>([]);
  const ttsPlayingRef = useRef(false);
  // 자기소개 → 본 면접 전환 시 Transition Audio가 끝나기 전까지 질문 TTS를 재생하지 않도록 하는 게이트
  const suppressTtsUntilTransitionRef = useRef(false);
  const hasSpeechRef = useRef(false);
  const speechStartTsRef = useRef<number | null>(null);
  const silenceStartTsRef = useRef<number | null>(null);
  const onLevelRef = useRef<(level: number, ts: number) => void>(() => {});

  // Media Control State
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const turnEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    abortStream,
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
  const [timeReducedToast, setTimeReducedToast] = useState(false); // New State
  const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChunk = useCallback(
    (payload: {
      chunk: string | ArrayBuffer;
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

  const stopRecording = useCallback(
    (durationMs?: number) => {
      if (!recording) return;

      stop(); // Stop recording via hook

      setIsUserSpeaking(false);

      // 30초 미만 & SELF_INTRO 단계이며, 남은 시간이 충분할 때만 abort 처리
      const elapsedSinceStageStart = Date.now() - stageStartTimeRef.current;
      const SELF_INTRO_LIMIT_MS = 90000; // 90초
      const remainingTime = SELF_INTRO_LIMIT_MS - elapsedSinceStageStart;
      const MIN_REMAINING_TIME_MS = 30000; // 30초

      if (
        durationMs &&
        durationMs < 30000 &&
        currentStageRef.current === InterviewStage.SELF_INTRO &&
        remainingTime >= MIN_REMAINING_TIME_MS // 남은 시간이 30초 이상일 때만 제약 적용
      ) {
        console.log("Self intro too short (<30s). Aborting stream.");
        abortStream();

        // 안내 음성과 기존 LLM TTS가 섞이지 않도록 현재 TTS 큐와 상태를 완전히 초기화
        ttsQueueRef.current = [];
        ttsPlayingRef.current = false;
        setIsInterviewerSpeaking(false);

        const persona = interviewMeta?.personality || "COMFORTABLE";
        const ttsEngine = (interviewMeta as any)?.ttsEngine || "edge";
        const audioPath = getAudioPath(
          "feedback",
          "retry_short",
          persona,
          ttsEngine,
        );

        if (audioRef.current) {
          audioRef.current.src = audioPath;
          // 안내 멘트 재생 동안에는 면접관이 말하는 것으로 표시
          setIsInterviewerSpeaking(true);
          setConversationState("SPEAKING");

          audioRef.current.onended = () => {
            setIsInterviewerSpeaking(false);
            // 안내 멘트가 끝난 뒤에만 다시 녹음 시작
            if (!manualPaused && connected) {
              startRecording().catch(console.error);
            } else {
              setConversationState("IDLE");
            }
          };
          audioRef.current.onerror = (err) => {
            console.error("Retry audio play failed:", err);
            setIsInterviewerSpeaking(false);
            if (!manualPaused && connected) {
              startRecording().catch(console.error);
            } else {
              setConversationState("IDLE");
            }
          };
          audioRef.current.play().catch((err) => {
            console.error("Retry audio play failed:", err);
            setIsInterviewerSpeaking(false);
            if (!manualPaused && connected) {
              startRecording().catch(console.error);
            } else {
              setConversationState("IDLE");
            }
          });
        }
        return; // sendFinal 호출하지 않음
      }

      sendFinal(); // 정상 종료 시 Final chunk 전송

      setThinking(null);
      setConversationState("PROCESSING");
      finalizeStreamingMessage();
      hasSpeechRef.current = false;
      speechStartTsRef.current = null;
      silenceStartTsRef.current = null;
    },
    [
      recording,
      stop,
      sendFinal,
      abortStream,
      manualPaused,
      connected,
      finalizeStreamingMessage,
      interviewMeta,
      // startRecording은 여기서 호출되지만 의존성에 없으면 stale closure 가능성 있음.
      // 하지만 startRecording은 ref나 외부 상태를 많이 사용하여 stable할 수 있음.
      // 여기서는 safe하게 startRecording을 의존성에 추가하지 않고(정의 순서 문제 회피),
      // 필요하다면 useRef로 startRecording을 감싸서 호출하거나...
      // 일단 startRecording은 컴포넌트 내 함수이므로 직접 호출 가능.
    ],
  );

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
      stop(); // useAudioRecorder의 stop 호출
    };
  }, [id, location.state, initVideo, stop]);

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
        stopRecording(speechDuration);
        setConversationState("PROCESSING");
        hasSpeechRef.current = false;
        speechStartTsRef.current = null;
        silenceStartTsRef.current = null;
      }
    },
    [
      conversationState,
      manualPaused,
      recording,
      stopRecording,
      abortStream,
      connected,
    ],
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
    // 1. If currently playing (either TTS chunk or pre-recorded audioRef), do nothing
    if (
      ttsPlayingRef.current ||
      (audioRef.current && !audioRef.current.paused)
    ) {
      return;
    }

    // 2. If Queue has items, play immediately
    if (ttsQueueRef.current.length > 0) {
      if (turnEndTimeoutRef.current) {
        clearTimeout(turnEndTimeoutRef.current);
        turnEndTimeoutRef.current = null;
      }

      const next = ttsQueueRef.current.shift();
      if (!next?.audioData) {
        playNextTts();
        return;
      }

      ttsPlayingRef.current = true;
      // Stop recording if currently recording (echo cancellation)
      if (recording) stopRecording();

      setConversationState("SPEAKING");
      setIsInterviewerSpeaking(true);

      try {
        const binary = atob(next.audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        const onAudioEnd = () => {
          URL.revokeObjectURL(url);
          ttsPlayingRef.current = false;
          setIsInterviewerSpeaking(false);

          // Attempt to play next immediately
          playNextTts();
        };

        audio.onended = onAudioEnd;
        audio.onerror = () => {
          console.error("Audio playback error");
          onAudioEnd();
        };

        audio.play().catch((err) => {
          console.error("Audio play failed", err);
          onAudioEnd();
        });
      } catch (err) {
        console.error("Audio decode error", err);
        ttsPlayingRef.current = false;
        setIsInterviewerSpeaking(false);
        playNextTts();
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

      const shouldResumeRecording = () => {
        const allowedStages = [
          InterviewStage.CANDIDATE_GREETING,
          InterviewStage.SELF_INTRO,
          InterviewStage.IN_PROGRESS,
        ];
        return allowedStages.includes(currentStageRef.current);
      };

      if (!manualPaused && connected && shouldResumeRecording()) {
        startRecording().catch(console.error);
      } else {
        setConversationState("IDLE");
      }

      if (
        (currentStageRef.current === InterviewStage.INTERVIEWER_INTRO ||
          currentStageRef.current === InterviewStage.SELF_INTRO_PROMPT) &&
        ttsQueueRef.current.length === 0
      ) {
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
      // 자기소개에서 본 면접으로 넘어가는 첫 질문은
      // Transition Audio가 끝난 뒤에만 재생되도록 suppress 플래그로 게이트 한다.
      if (!suppressTtsUntilTransitionRef.current) {
        playNextTts();
      }
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

      if (recording) stopRecording();

      const personaKey = interviewMeta?.personality || "COMFORTABLE";
      const engineKey = interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
      const audioPath = getAudioPath(
        "feedback",
        "please_repeat",
        personaKey,
        engineKey,
      );

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

      if (e.currentStage === InterviewStage.GREETING) {
        // 면접관 인사 음성 재생 (리드 면접관 or 첫 번째 역할 기준)
        setTimeout(() => {
          const personaKey = interviewMeta?.personality || "COMFORTABLE";
          const activeRole =
            interviewMeta?.interviewerRoles?.[0] || ("TECH" as InterviewRole);
          setCurrentPersonaId(activeRole); // UI 상에서 말하는 면접관을 역할 기준으로 표시
          setIsInterviewerSpeaking(true); // Show speaking border

          const audioPath = getAudioPath(
            "greeting",
            "greeting",
            personaKey,
            "edge",
          );
          if (audioRef.current) {
            audioRef.current.src = audioPath;
            audioRef.current.onended = () => {
              setIsInterviewerSpeaking(false);
              notifyStageReady(InterviewStage.GREETING);
            };
            audioRef.current.play().catch((err) => {
              console.error("인사말 재생 실패:", err);
              setIsInterviewerSpeaking(false);
              notifyStageReady(InterviewStage.GREETING);
            });
          }
        }, 1500);
      } else if (e.currentStage === InterviewStage.CANDIDATE_GREETING) {
        // 지원자 인사 단계: 녹음 시작
        if (!manualPaused && connected) {
          startRecording();
        }
      } else if (e.currentStage === InterviewStage.SELF_INTRO) {
        // SELF_INTRO 시작
        stageStartTimeRef.current = Date.now();
        setTimeLeft(90);
        if (!manualPaused && connected) {
          startRecording();
        }
      } else if (e.currentStage === InterviewStage.IN_PROGRESS) {
        setTimeLeft(null);

        // SELF_INTRO -> IN_PROGRESS 전환 시 Transition Audio 재생 (조건부)
        if (e.previousStage === InterviewStage.SELF_INTRO) {
          // 첫 질문 오디오가 이미 도착하더라도, Transition Audio가 끝날 때까지는 재생하지 않는다.
          suppressTtsUntilTransitionRef.current = true;
          setIsInterviewerSpeaking(true);
          ttsPlayingRef.current = true; // 질문 TTS 대기

          const personaKey = interviewMeta?.personality || "COMFORTABLE";
          const activeRole =
            interviewMeta?.interviewerRoles?.[0] || ("TECH" as InterviewRole);
          setCurrentPersonaId(activeRole);
          const transitionPath = getAudioPath(
            "guide",
            "transition_intro",
            personaKey,
            "edge",
          );

          if (audioRef.current) {
            audioRef.current.src = transitionPath;
            audioRef.current.onended = () => {
              ttsPlayingRef.current = false;
              setIsInterviewerSpeaking(false);
              suppressTtsUntilTransitionRef.current = false;
              playNextTts(); // 대기 중이던 질문 TTS 재생
            };
            audioRef.current.onerror = () => {
              console.error("Transition audio failed");
              ttsPlayingRef.current = false;
              setIsInterviewerSpeaking(false);
              suppressTtsUntilTransitionRef.current = false;
              playNextTts();
            };
            audioRef.current.play().catch(console.error);
          }
        }
      } else if (e.currentStage === InterviewStage.INTERVIEWER_INTRO) {
        // 면접관 소개 단계: LLM 스트리밍(TTS)을 통해 각 면접관이 순차적으로 자기소개함.
        console.log("Waiting for interviewer self-introductions...");
      } else if (e.currentStage === InterviewStage.SELF_INTRO_PROMPT) {
        // 1분 자기소개 요청 음성 재생 (사전 녹음)
        const personaKey = interviewMeta?.personality || "RANDOM";
        const activeRole =
          interviewMeta?.interviewerRoles?.[0] || ("TECH" as InterviewRole);
        setCurrentPersonaId(activeRole);
        setIsInterviewerSpeaking(true);

        const engineKey =
          interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
        const audioPath = getAudioPath(
          "prompt",
          "self_intro_prompt",
          personaKey,
          engineKey,
        );
        if (audioRef.current) {
          audioRef.current.src = audioPath;
          audioRef.current.onended = () => {
            setIsInterviewerSpeaking(false);
            notifyStageReady(InterviewStage.SELF_INTRO_PROMPT);
          };
          audioRef.current.onerror = () => {
            console.error("Self intro prompt audio failed");
            setIsInterviewerSpeaking(false);
            notifyStageReady(InterviewStage.SELF_INTRO_PROMPT);
          };
          audioRef.current.play().catch((err) => {
            console.error("자기소개 요청 재생 실패:", err);
            setIsInterviewerSpeaking(false);
            notifyStageReady(InterviewStage.SELF_INTRO_PROMPT);
          });
        }
      } else if (e.currentStage === InterviewStage.LAST_QUESTION_PROMPT) {
        // 마지막 질문 안내 음성 재생 (사전 녹음)
        const personaKey = interviewMeta?.personality || "RANDOM";
        const activeRole =
          interviewMeta?.interviewerRoles?.[0] || ("TECH" as InterviewRole);
        setCurrentPersonaId(activeRole);
        setIsInterviewerSpeaking(true);

        const engineKey =
          interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
        const audioPath = getAudioPath(
          "prompt",
          "last_question_prompt",
          personaKey,
          engineKey,
        );
        if (audioRef.current) {
          audioRef.current.src = audioPath;
          audioRef.current.onended = () => {
            setIsInterviewerSpeaking(false);
            notifyStageReady(InterviewStage.LAST_QUESTION_PROMPT);
          };
          audioRef.current.onerror = () => {
            console.error("Last question prompt audio failed");
            setIsInterviewerSpeaking(false);
            notifyStageReady(InterviewStage.LAST_QUESTION_PROMPT);
          };
          audioRef.current.play().catch((err) => {
            console.error("마지막 질문 안내 재생 실패:", err);
            setIsInterviewerSpeaking(false);
            notifyStageReady(InterviewStage.LAST_QUESTION_PROMPT);
          });
        }
      } else if (e.currentStage === InterviewStage.LAST_ANSWER) {
        // 마지막 답변 단계: 녹음 시작
        if (!manualPaused && connected) {
          startRecording();
        }
      } else if (e.currentStage === InterviewStage.CLOSING_GREETING) {
        // 면접관 마무리 인사
        const personaKey = interviewMeta?.personality || "RANDOM";
        const activeRole =
          interviewMeta?.interviewerRoles?.[0] || ("TECH" as InterviewRole);
        setCurrentPersonaId(activeRole);
        setIsInterviewerSpeaking(true);

        const engineKey =
          interviewMeta?.type === "PRACTICE" ? "edge" : "openai";
        const audioPath = getAudioPath(
          "closing",
          "closing",
          personaKey,
          engineKey,
        );

        if (audioRef.current) {
          audioRef.current.src = audioPath;
          audioRef.current.onended = () => {
            setIsInterviewerSpeaking(false);
            // 마무리 인사 TTS가 끝난 뒤에만 사용자 끝인사 녹음을 시작
            if (!manualPaused && connected) {
              startRecording();
            }
          };
          audioRef.current.onerror = () => {
            console.error("Closing greeting audio failed");
            setIsInterviewerSpeaking(false);
          };
          audioRef.current.play().catch((err) => {
            console.error("마무리 인사 재생 실패:", err);
            setIsInterviewerSpeaking(false);
          });
        }
      }
    });

    setOnIntervene((e: InterveneEvent) => {
      console.log(`Intervention received: ${e.message}`);
      setIntervention(e.message);

      // 개입 메시지 오디오 재생
      setIsInterviewerSpeaking(true);
      const personaKey = interviewMeta?.personality || "RANDOM";
      const audioPath = getAudioPath(
        "guide",
        "intervene_intro",
        personaKey,
        "edge",
      );

      if (audioRef.current) {
        audioRef.current.src = audioPath;
        audioRef.current.onended = () => {
          setIsInterviewerSpeaking(false);
          setIntervention(null);
        };
        audioRef.current.onerror = () => {
          console.error("Intervene audio failed");
          setIsInterviewerSpeaking(false);
          setIntervention(null);
        };
        audioRef.current.play().catch(console.error);
      } else {
        // 오디오 없으면 5초 후 메시지 제거
        setTimeout(() => setIntervention(null), 5000);
      }
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
      InterviewStage.CANDIDATE_GREETING,
      InterviewStage.SELF_INTRO,
      InterviewStage.IN_PROGRESS,
      InterviewStage.LAST_ANSWER,
    ];
    if (!recording && autoRecordStages.includes(currentStage)) {
      startRecording();
    }
  }, [connected, manualPaused, recording, startRecording, micOn, currentStage]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync audioRef state with ttsPlayingRef to prevent overlaps
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      // ttsPlayingRef.current = true; // Pre-recorded audio already sets this in some stages, but let's be safe
    };
    const handleEnd = () => {
      ttsPlayingRef.current = false;
      setIsInterviewerSpeaking(false);
      playNextTts();
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("error", handleEnd);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("error", handleEnd);
    };
  }, [playNextTts]);
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

  const interviewerCount = interviewMeta?.interviewerCount || 1;
  const selectedRoles = interviewMeta?.interviewerRoles || [
    "TECH" as InterviewRole,
  ];

  const PERSONA_UI_MAP: Record<
    InterviewPersona,
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
          {timeLeft !== null && (
            <div className={styles.stageTimer}>
              <span className={styles.timerLabel}>자기소개 시간</span>
              <span className={styles.timerValue}>
                {Math.floor(timeLeft / 60)}:
                {(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )}
          {currentStage === InterviewStage.SELF_INTRO && (
            <button
              className={styles.skipBtn}
              onClick={() => {
                if (recording) stopRecording();
                socket?.emit("interview:skip_stage", {
                  interviewSessionId: id,
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
              (currentPersonaId === roleId || interviewerCount === 1);

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
          <Link to="/" className={styles.exitBtn}>
            나가기
          </Link>
        </div>
      </footer>
      <audio ref={audioRef} hidden />
    </div>
  );
}
