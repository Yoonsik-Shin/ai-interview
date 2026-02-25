import React, { useState } from "react";
import { client } from "../../api/client";
import "./DevToolPanel.css";

interface DevToolPanelProps {
  interviewId: string;
  debugInfo?: {
    currentStage: string;
    conversationState: string;
    ttsQueueCount: number;
    ttsQueueItems: Array<{ text: string; isLocal: boolean }>;
    sttHistory: string[];
    thinking: string | null;
    connected: boolean;
  };
}

const STAGES = [
  "WAITING",
  "GREETING",
  "CANDIDATE_GREETING",
  "INTERVIEWER_INTRO",
  "SELF_INTRO_PROMPT",
  "SELF_INTRO",
  "IN_PROGRESS",
  "LAST_QUESTION_PROMPT",
  "LAST_ANSWER",
  "CLOSING_GREETING",
  "COMPLETED",
];

export const DevToolPanel: React.FC<DevToolPanelProps> = ({
  interviewId,
  debugInfo,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  // Drag Logic
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const initialPos = React.useRef({ x: 0, y: 0 });
  const dragDistance = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 버튼, 선택 상자 등 상호작용 요소 클릭 시에는 드래그 방지
    // 단, devtool-toggle 버튼 자체는 드래그를 허용해야 함
    const target = e.target as HTMLElement;
    if (
      target.closest("button, select, input, .close-panel") &&
      !target.closest(".devtool-toggle")
    ) {
      return;
    }

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
    dragDistance.current = 0;
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = dragStartPos.current.x - e.clientX;
      const deltaY = dragStartPos.current.y - e.clientY;

      dragDistance.current += Math.sqrt(deltaX ** 2 + deltaY ** 2);

      setPosition({
        x: initialPos.current.x + deltaX,
        y: initialPos.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const togglePanel = () => {
    // 마우스 이동 거리가 아주 작을 때만(클릭) 토글
    if (dragDistance.current < 5) {
      setIsOpen(!isOpen);
    }
  };

  const handleSkip = async () => {
    // ... existing handleSkip logic
    if (!selectedStage) {
      setMessage("Please select a stage");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      await client.post(`/v1/devtool/interviews/${interviewId}/force-stage`, {
        targetStage: selectedStage,
      });

      setMessage(`✓ Stage changed to ${selectedStage}`);
    } catch (error) {
      console.error("[DevTool] Failed to change stage:", error);
      setMessage("✗ Failed to change stage");
    } finally {
      setIsLoading(false);
    }
  };

  // 개발 환경에서만 렌더링
  if (import.meta.env.MODE !== "development") {
    return null;
  }

  return (
    <div
      className={`devtool-container ${isOpen ? "is-open" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
      }}
    >
      <button
        className="devtool-toggle"
        onMouseDown={handleMouseDown}
        onClick={togglePanel}
        title="Drag to move, click to toggle"
      >
        <span className="devtool-toggle-icon">🛠️</span>
      </button>

      <div className="devtool-panel" onMouseDown={handleMouseDown}>
        <div className="devtool-header">
          <span className="devtool-icon">🛠️</span>
          <h3>DevTool - Debugger</h3>
          <button className="close-panel" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>

        <div className="devtool-content">
          {debugInfo && (
            <div className="debug-info-section">
              <div className="debug-item">
                <span className="label">Status:</span>
                <span
                  className="value"
                  style={{ color: debugInfo.connected ? "#10b981" : "#ef4444" }}
                >
                  {debugInfo.connected ? "CONNECTED" : "DISCONNECTED"}
                </span>
              </div>
              <div className="debug-item">
                <span className="label">Stage:</span>
                <span className="value highlighting">
                  {debugInfo.currentStage}
                </span>
              </div>
              <div className="debug-item">
                <span className="label">Conv State:</span>
                <span className="value">{debugInfo.conversationState}</span>
              </div>
              <div className="debug-item">
                <span className="label">TTS Queue:</span>
                <span className="value highlighting">
                  {debugInfo.ttsQueueCount}
                </span>
              </div>
              {debugInfo.thinking && (
                <div className="debug-item thinking">
                  <span className="label">Thinking:</span>
                  <p className="value-p">{debugInfo.thinking}</p>
                </div>
              )}

              {debugInfo.ttsQueueItems.length > 0 && (
                <div className="debug-item tts-queue-visualizer">
                  <span className="label">TTS Queue:</span>
                  <ul className="tts-item-list">
                    {debugInfo.ttsQueueItems.map((item, idx) => (
                      <li
                        key={idx}
                        className={`tts-item ${item.isLocal ? "local" : "streaming"}`}
                      >
                        <span className="type-badge">
                          {item.isLocal ? "L" : "S"}
                        </span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {debugInfo.sttHistory && debugInfo.sttHistory.length > 0 && (
                <div className="debug-item stt-history-visualizer">
                  <span className="label">Recent STT:</span>
                  <ul className="stt-item-list">
                    {debugInfo.sttHistory.map((text, idx) => (
                      <li key={idx} className="stt-item">
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="divider-horizontal" />

          <div className="stage-selector">
            <label htmlFor="stage-select">Force Stage Transition:</label>
            <select
              id="stage-select"
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              disabled={isLoading}
            >
              <option value="">-- Select Stage --</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          <button
            className="skip-button"
            onClick={handleSkip}
            disabled={isLoading || !selectedStage}
          >
            {isLoading ? "Changing..." : "Apply Force Stage"}
          </button>

          {message && (
            <div
              className={`message ${message.startsWith("✓") ? "success" : "error"}`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
