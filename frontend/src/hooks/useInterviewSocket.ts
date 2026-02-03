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
  COMPLETED = "COMPLETED",
}

export type SttResult = {
  text: string;
  interviewSessionId: string;
  isFinal: boolean;
  engine?: string;
};
export type TranscriptToken = { token: string; timestamp?: string };
export type ThinkingEvent = {
  nodeName: string;
  status: string;
  message?: string;
};
export type AudioChunk = {
  sentenceIndex: number;
  audioData: string;
  duration?: number;
};
export type StageChangedEvent = {
  interviewSessionId: string;
  previousStage: InterviewStage;
  currentStage: InterviewStage;
};

export type InterveneEvent = {
  message: string;
  type?: string;
};

export type AudioAck = {
  chunkId?: string;
  interviewSessionId: string;
  isFinal?: boolean;
  timestamp: string;
};

export function useInterviewSocket(interviewId: string | null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const onStt = useRef<(e: SttResult) => void>(() => {});
  const onTranscript = useRef<(e: TranscriptToken) => void>(() => {});
  const onThinking = useRef<(e: ThinkingEvent) => void>(() => {});
  const onAudio = useRef<(e: AudioChunk) => void>(() => {});
  const onAck = useRef<(e: AudioAck) => void>(() => {});
  const onStageChanged = useRef<(e: StageChangedEvent) => void>(() => {});
  const onIntervene = useRef<(e: InterveneEvent) => void>(() => {});

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
  const setOnIntervene = useCallback((fn: (e: InterveneEvent) => void) => {
    onIntervene.current = fn;
  }, []);

  const onRetryAnswer = useRef<(e: { message: string }) => void>(() => {});
  const setOnRetryAnswer = useCallback(
    (fn: (e: { message: string }) => void) => {
      onRetryAnswer.current = fn;
    },
    [],
  );

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
      query: { type: "interview", interviewSessionId: String(interviewId) },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
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
    socket.on("interview:intervene", (p: InterveneEvent) =>
      onIntervene.current(p),
    );
    socket.on("interview:retry_answer", (p: { message: string }) =>
      onRetryAnswer.current(p),
    );
    socket.on("interview:error", (p: { code?: string; message?: string }) =>
      setError(p?.message ?? "인터뷰 오류"),
    );

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
        .off("interview:intervene")
        .off("interview:retry_answer")
        .off("interview:error");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [interviewId]);

  const sendAudioChunk = useCallback(
    (payload: {
      chunk: string;
      interviewSessionId: string;
      isFinal?: boolean;
      format?: string;
      sampleRate?: number;
      chunkId?: string;
    }) => {
      socketRef.current?.emit("interview:audio_chunk", payload);
    },
    [],
  );

  const notifyStageReady = useCallback(
    (stage: InterviewStage) => {
      if (socketRef.current?.connected && interviewId != null) {
        socketRef.current.emit("interview:stage_ready", {
          interviewSessionId: interviewId,
          currentStage: stage,
        });
      }
    },
    [interviewId],
  );

  const abortStream = useCallback(() => {
    if (socketRef.current?.connected && interviewId != null) {
      socketRef.current.emit("interview:abort_stream", {
        interviewSessionId: interviewId,
      });
    }
  }, [interviewId]);

  return {
    connected,
    error,
    sendAudioChunk,
    notifyStageReady,
    abortStream,
    setOnStt,
    setOnTranscript,
    setOnThinking,
    setOnAudio,
    setOnAck,
    setOnStageChanged,
    setOnIntervene,
    setOnRetryAnswer,
    socket: socketRef.current,
  };
}
