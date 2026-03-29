import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "";

export enum InterviewStage {
  WAITING = "WAITING",
  GREETING = "GREETING",
  CANDIDATE_GREETING = "CANDIDATE_GREETING",
  INTERVIEWER_INTRO = "INTERVIEWER_INTRO",
  SELF_INTRO_PROMPT = "SELF_INTRO_PROMPT",
  SELF_INTRO = "SELF_INTRO",
  IN_PROGRESS = "IN_PROGRESS",
  LAST_QUESTION_PROMPT = "LAST_QUESTION_PROMPT",
  LAST_ANSWER = "LAST_ANSWER",
  CLOSING_GREETING = "CLOSING_GREETING",
  COMPLETED = "COMPLETED",
}

export type SttResult = {
  text: string;
  interviewId: string;
  isFinal: boolean;
  engine?: string;
};
export type TranscriptToken = {
  token: string;
  timestamp?: string;
  thinking?: string;
  reduceTotalTime?: boolean;
  nextDifficulty?: number;
  currentPersonaId?: string;
  turnCount?: number;
  type?: string;
  timeLeft?: number;
  isFinal?: boolean;
};
export type ThinkingEvent = {
  nodeName: string;
  status: string;
  message?: string;
};
export type AudioChunk = {
  sentenceIndex: number;
  audioData: string;
  duration?: number;
  persona?: string;
};
export type StageChangedEvent = {
  interviewId: string;
  previousStage: InterviewStage;
  currentStage: InterviewStage;
  selfIntroRetryCount?: number;
  selfIntroElapsedSeconds?: number;
  isMaxRetryExceeded?: boolean;
};

export type TurnStateEvent = {
  stage: InterviewStage;
  status: "READY" | "LISTENING" | "THINKING" | "SPEAKING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  canCandidateSpeak: boolean;
  turnCount: number;
  activePersonaId?: string;
  timestamp?: string;
};

export type InterveneEvent = {
  message: string;
  type?: string;
};

export type RetryAnswerEvent = {
  message: string;
  selfIntroRetryCount?: number;
  selfIntroElapsedSeconds?: number;
};

export type AudioAck = {
  chunkId?: string;
  interviewId: string;
  isFinal?: boolean;
  timestamp: string;
};

export type DebugTraceEvent = {
  timestamp: number;
  stage: string;
  data: any;
};

export function useInterviewSocket(interviewId: string | null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTraceJoined, setIsTraceJoined] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const onStt = useRef<(e: SttResult) => void>(() => {});
  const onTranscript = useRef<(e: TranscriptToken) => void>(() => {});
  const onThinking = useRef<(e: ThinkingEvent) => void>(() => {});
  const onAudio = useRef<(e: AudioChunk) => void>(() => {});
  const onAck = useRef<(e: AudioAck) => void>(() => {});
  const onStageChanged = useRef<(e: StageChangedEvent) => void>(() => {});
  const onTurnState = useRef<(e: TurnStateEvent) => void>(() => {});
  const onIntervene = useRef<(e: InterveneEvent) => void>(() => {});
  const onRetryAnswer = useRef<(e: RetryAnswerEvent) => void>(() => {});
  const onResumeProcessed = useRef<
    (e: { resumeId: string; status: string; userId: string }) => void
  >(() => {});
  const onDebugTrace = useRef<(e: DebugTraceEvent) => void>(() => {});

  const setOnStt = useCallback((fn: (e: SttResult) => void) => {
    onStt.current = fn;
  }, []);
  const setOnTranscript = useCallback((fn: (e: TranscriptToken) => void) => {
    onTranscript.current = fn;
  }, []);
  const setOnThinking = useCallback((fn: (e: ThinkingEvent) => void) => {
    onThinking.current = fn;
  }, []);
  const setOnAudio = useCallback((fn: (e: AudioChunk) => void) => {
    onAudio.current = fn;
  }, []);
  const setOnAck = useCallback((fn: (e: AudioAck) => void) => {
    onAck.current = fn;
  }, []);
  const setOnStageChanged = useCallback(
    (fn: (e: StageChangedEvent) => void) => {
      onStageChanged.current = fn;
    },
    [],
  );
  const setOnTurnState = useCallback((fn: (e: TurnStateEvent) => void) => {
    onTurnState.current = fn;
  }, []);
  const setOnIntervene = useCallback((fn: (e: InterveneEvent) => void) => {
    onIntervene.current = fn;
  }, []);

  const setOnRetryAnswer = useCallback(
    (fn: (e: RetryAnswerEvent) => void) => {
      onRetryAnswer.current = fn;
    },
    [],
  );

  const setOnResumeProcessed = useCallback(
    (fn: (e: { resumeId: string; status: string; userId: string }) => void) => {
      onResumeProcessed.current = fn;
    },
    [],
  );

  const setOnDebugTrace = useCallback((fn: (e: DebugTraceEvent) => void) => {
    onDebugTrace.current = fn;
  }, []);

  useEffect(() => {
    if (interviewId == null) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: (cb) => {
        const token = localStorage.getItem("accessToken");
        cb({ token: token ? `Bearer ${token}` : "" });
      },
      query: { type: "INTERVIEW", interviewId: String(interviewId) },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    setSocket(socket);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => {
      setConnected(false);
      setIsTraceJoined(false);
    });
    socket.on("connect_error", (err) => setError(err.message ?? "연결 실패"));
    socket.on("connection:error", (p: { code?: string; message?: string }) =>
      setError(p?.message ?? "연결 오류"),
    );
    socket.on("interview:stt_result", (p: SttResult) => onStt.current(p));
    socket.on("interview:transcript", (p: TranscriptToken) =>
      onTranscript.current(p),
    );
    socket.on("interview:thinking", (p: ThinkingEvent) =>
      onThinking.current(p),
    );
    socket.on("interview:audio", (p: AudioChunk) => onAudio.current(p));
    socket.on("interview:audio_ack", (p: AudioAck) => onAck.current(p));
    socket.on("interview:stage_changed", (p: StageChangedEvent) =>
      onStageChanged.current(p),
    );
    socket.on("interview:turn_state", (p: TurnStateEvent) =>
      onTurnState.current(p),
    );
    socket.on("interview:intervene", (p: InterveneEvent) =>
      onIntervene.current(p),
    );
    socket.on("interview:retry_answer", (p: RetryAnswerEvent) =>
      onRetryAnswer.current(p),
    );
    socket.on(
      "resume:processed",
      (p: { resumeId: string; status: string; userId: string }) =>
        onResumeProcessed.current(p),
    );
    socket.on("interview:error", (p: { code?: string; message?: string }) =>
      setError(p?.message ?? "인터뷰 오류"),
    );
    socket.on("debug:trace", (p: DebugTraceEvent) => onDebugTrace.current(p));

    // 트레이스 참여 확인 리스너
    socket.on("debug:trace_joined", () => {
      if (import.meta.env.DEV) {
        console.log(`[Socket] Debug trace room joined successfully`);
      }
      setIsTraceJoined(true);
    });

    return () => {
      socket.off("connect").off("disconnect").off("connect_error");
      socket.off("connection:error");
      socket
        .off("interview:stt_result")
        .off("interview:transcript")
        .off("interview:thinking");
      socket
        .off("interview:audio")
        .off("interview:audio_ack")
        .off("interview:stage_changed")
        .off("interview:turn_state")
        .off("interview:intervene")
        .off("interview:retry_answer")
        .off("interview:error")
        .off("debug:trace")
        .off("debug:trace_joined");
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsTraceJoined(false);
    };
  }, [interviewId]);

  const joinDebugTrace = useCallback(() => {
    if (socket?.connected && interviewId != null) {
      if (import.meta.env.DEV) {
        console.log(`[Socket] Joining debug trace room for interview: ${interviewId}`);
      }
      socket.emit("debug:join_trace", {
        interviewId: interviewId,
      });
    }
  }, [socket, interviewId]);

  const sendAudioChunk = useCallback(
    (payload: {
      chunk: string | ArrayBuffer;
      interviewId: string;
      isFinal?: boolean;
      format?: string;
      sampleRate?: number;
      chunkId?: string;
      retryCount?: number;
    }) => {
      socket?.emit("interview:audio_chunk", payload);
    },
    [socket],
  );

  const notifyStageReady = useCallback(
    (stage: InterviewStage) => {
      if (socket?.connected && interviewId != null) {
        socket.emit("interview:stage_ready", {
          interviewId: interviewId,
          currentStage: stage,
        });
      }
    },
    [socket, interviewId],
  );

  const abortStream = useCallback(() => {
    if (socket?.connected && interviewId != null) {
      socket.emit("interview:abort_stream", {
        interviewId: interviewId,
      });
    }
  }, [socket, interviewId]);

  const requestRetry = useCallback(
    (stage: InterviewStage, durationSeconds?: number) => {
      if (socket?.connected && interviewId != null) {
        socket.emit("interview:request_retry", {
          interviewId,
          currentStage: stage,
          durationSeconds,
        });
      }
    },
    [socket, interviewId],
  );

  return {
    connected,
    error,
    isTraceJoined,
    sendAudioChunk,
    notifyStageReady,
    abortStream,
    requestRetry,
    setOnStt,
    setOnTranscript,
    setOnThinking,
    setOnAudio,
    setOnAck,
    setOnStageChanged,
    setOnTurnState,
    setOnIntervene,
    setOnRetryAnswer,
    setOnResumeProcessed,
    setOnDebugTrace,
    joinDebugTrace,
    socket,
  };
}
