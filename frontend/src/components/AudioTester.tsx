import { useState, useEffect, useRef } from "react";

interface AudioTesterProps {
  stream: MediaStream | null;
  onTestComplete?: () => void;
}

export function AudioTester({ stream, onTestComplete }: AudioTesterProps) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // 실시간 레벨 미터 업데이트
  useEffect(() => {
    if (!stream) {
      setAudioLevel(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;

    const setupAnalyser = () => {
      try {
        audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (err) {
        console.error("Audio level monitor error:", err);
      }
    };

    setupAnalyser();

    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (source) source.disconnect();
      if (audioContext) audioContext.close().catch(() => {});
    };
  }, [stream]);

  // 스트림 변경 시 초기화
  useEffect(() => {
    setRecording(false);
    setAudioUrl(null);
    chunksRef.current = [];
  }, [stream]);

  // 오디오 제약 조건 강제 적용
  useEffect(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack
          .applyConstraints({
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          })
          .catch((err) => console.error("Constraint apply error:", err));
      }
    }
  }, [stream]);

  const startRecording = () => {
    if (!stream) return;
    try {
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onTestComplete?.();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setAudioUrl(null);
    } catch (err) {
      console.error("Recording start error:", err);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (!stream) {
    return (
      <div
        style={{
          padding: "1.5rem",
          background: "rgba(15, 23, 42, 0.4)",
          borderRadius: "16px",
          textAlign: "center",
          color: "#64748b",
          fontSize: "0.875rem",
          border: "1px dashed rgba(255,255,255,0.1)",
        }}
      >
        마이크가 꺼져있거나 선택되지 않았습니다.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1rem",
        background: audioUrl
          ? "rgba(16, 185, 129, 0.05)"
          : "rgba(15, 23, 42, 0.4)",
        borderRadius: "20px",
        border: audioUrl
          ? "1px solid rgba(16, 185, 129, 0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🎙️</span>
          <span
            style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8fafc" }}
          >
            마이크 테스트
          </span>
        </div>
        {recording && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "2px 8px",
              borderRadius: "9999px",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                background: "#ef4444",
                borderRadius: "50%",
                animation: "pulse 1.5s infinite",
              }}
            ></span>
            <span
              style={{ fontSize: "0.65rem", color: "#ef4444", fontWeight: 800 }}
            >
              REC
            </span>
          </div>
        )}
      </div>

      <div
        style={{ fontSize: "0.8125rem", color: "#94a3b8", lineHeight: "1.5" }}
      >
        {audioUrl
          ? "녹음된 내 목소리를 들어보세요. 잘 들린다면 면접 준비가 완료되었습니다!"
          : "테스트 버튼을 누르고 3초 정도 말씀해 보세요. 내 목소리가 어떻게 들리는지 바로 확인할 수 있습니다."}
      </div>

      {/* 레벨 미터 - 마이크 출력과 직접적으로 연결된 느낌 부여 */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            fontSize: "0.7rem",
            color: "#64748b",
            fontWeight: 600,
            minWidth: "35px",
          }}
        >
          LEVEL
        </div>
        <div
          style={{
            flex: 1,
            height: "10px",
            background: "rgba(0,0,0,0.3)",
            borderRadius: "9999px",
            overflow: "hidden",
            position: "relative",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(2, audioLevel * 100 * 1.8))}%`,
              background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
              transition: "width 0.08s ease-out",
              borderRadius: "9999px",
              boxShadow:
                audioLevel > 0.01 ? "0 0 8px rgba(16, 185, 129, 0.4)" : "none",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            style={{
              width: "100%",
              padding: "0.875rem",
              borderRadius: "14px",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              background: "rgba(16, 185, 129, 0.05)",
              color: "#34d399",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.95rem",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.6rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(16, 185, 129, 0.15)";
              e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(16, 185, 129, 0.05)";
              e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.2)";
            }}
          >
            🎤 테스트 시작하기
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            style={{
              width: "100%",
              padding: "0.875rem",
              borderRadius: "14px",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#fca5a5",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.95rem",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.6rem",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")
            }
          >
            ⏹️ 녹음 중지 및 들어보기
          </button>
        )}
      </div>

      {audioUrl && (
        <div
          style={{
            marginTop: "0.5rem",
            background: "rgba(15, 23, 42, 0.8)",
            padding: "1rem",
            borderRadius: "14px",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          <div
            style={{
              marginBottom: "0.75rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>🔊</span> 내 목소리 다시듣기
          </div>
          <audio
            controls
            src={audioUrl}
            style={{ width: "100%", height: "36px", display: "block" }}
          />
          <style>{`
             @keyframes slideUp {
               from { opacity: 0; transform: translateY(10px); }
               to { opacity: 1; transform: translateY(0); }
             }
           `}</style>
        </div>
      )}
    </div>
  );
}
