import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useInterviewSocket, SttResult } from "../hooks/useInterviewSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioTester } from "../components/AudioTester";
import styles from "./InterviewSetup.module.css"; // Reuse styles

export function DebugPage() {
  const [interviewId, setInterviewId] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  const { socket, connected, error } = useInterviewSocket(interviewId || null);

  // Generate a random interview ID on mount
  useEffect(() => {
    setInterviewId(`debug-${Date.now()}`);
  }, []);

  const {
    start: startAudio,
    stop: stopAudio,
    sendFinal,
    recording,
    stream,
  } = useAudioRecorder(interviewId, (payload) => {
    if (socket && connected) {
      socket.emit("debug:test_audio", payload);
    }
  });

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  useEffect(() => {
    if (connected) {
      addLog("Socket connected!");
    }
  }, [connected]);

  useEffect(() => {
    if (error) {
      addLog(`Socket error: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    if (!socket) return;

    const handleSttResult = (data: SttResult) => {
      addLog(`STT Result: ${data.text} (Final: ${data.isFinal})`);
    };

    const handleRetry = (data: { message: string }) => {
      addLog(`Retry requested: ${data.message}`);
    };

    const handleAudioSaved = (data: { objectUrl: string }) => {
      addLog(`Audio stored on server: ${data.objectUrl}`);
      setSavedAudioUrl(data.objectUrl);
    };

    socket.on("interview:stt_result", handleSttResult);
    socket.on("interview:retry_answer", handleRetry);
    socket.on("interview:audio_saved", handleAudioSaved);

    return () => {
      socket.off("interview:stt_result", handleSttResult);
      socket.off("interview:retry_answer", handleRetry);
      socket.off("interview:audio_saved", handleAudioSaved);
    };
  }, [socket]);

  return (
    <div className={styles.wrap} style={{ color: "white", padding: "20px" }}>
      <header className={styles.header}>
        <Link to="/" className={styles.backButton}>
          ← 홈으로
        </Link>
        <h1 className={styles.headerTitle}>STT 디버깅 페이지 (PCM16)</h1>
      </header>

      <main className={styles.content}>
        <div className={styles.container}>
          <section className={styles.mediaSection}>
            <h2>1. 소켓 연결 상태</h2>
            <p>Interview ID: {interviewId}</p>
            <div
              style={{
                padding: "10px",
                borderRadius: "8px",
                background: connected
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(239, 68, 68, 0.2)",
                color: connected ? "#10b981" : "#ef4444",
                marginBottom: "20px",
              }}
            >
              {connected
                ? "연결됨 (Connected)"
                : `연결 안됨 (Disconnected) - ${error || "..."}`}
            </div>

            <h2>2. 오디오 테스트 (PCM16 / 16kHz)</h2>
            <div style={{ marginBottom: "20px" }}>
              {!recording ? (
                <button
                  onClick={() => {
                    startAudio();
                    addLog("Recording started...");
                  }}
                  className={styles.btn}
                  style={{ background: "#3b82f6" }}
                  disabled={!connected}
                >
                  마이크 켜기 & pcm16 전송 시작
                </button>
              ) : (
                <button
                  onClick={() => {
                    stopAudio();
                    sendFinal();
                    addLog(
                      "Recording stopped. Waiting for storage assembly...",
                    );
                  }}
                  className={styles.btn}
                  style={{ background: "#ef4444" }}
                >
                  중지
                </button>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <AudioTester stream={stream} />
            </div>

            <h2>3. STT 응답 로그</h2>
            <div
              style={{
                background: "rgba(0,0,0,0.5)",
                padding: "10px",
                borderRadius: "8px",
                height: "300px",
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "0.9rem",
                marginBottom: "20px",
              }}
            >
              {logs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    padding: "4px 0",
                  }}
                >
                  {log}
                </div>
              ))}
            </div>

            {savedAudioUrl && (
              <div
                style={{
                  padding: "15px",
                  background: "rgba(59, 130, 246, 0.2)",
                  borderRadius: "8px",
                  border: "1px solid #3b82f6",
                }}
              >
                <h3 style={{ marginTop: 0 }}>✅ 서버 저장 완료</h3>
                <p style={{ fontSize: "0.9rem", color: "#93c5fd" }}>
                  오디오 데이터가 서버에서 WAV 파일로 조립되어 저장되었습니다.
                </p>
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "10px" }}
                >
                  <audio
                    controls
                    src={savedAudioUrl}
                    style={{ height: "36px" }}
                  />
                  <a
                    href={savedAudioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.btn}
                    style={{
                      background: "#3b82f6",
                      padding: "8px 15px",
                      fontSize: "0.8rem",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    파일 다운로드
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
