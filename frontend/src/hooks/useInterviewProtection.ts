import { useEffect, useCallback } from "react";

interface UseInterviewProtectionProps {
  interviewId: string;
  isActive: boolean;
  onPause: () => Promise<void>;
}

/**
 * Layer 1: beforeunload 경고 및 자동 중지
 *
 * 브라우저 탭을 닫거나 새로고침할 때:
 * 1. 사용자에게 경고 메시지 표시
 * 2. navigator.sendBeacon으로 best-effort pause 시도
 */
export function useInterviewProtection({
  interviewId,
  isActive,
  onPause,
}: UseInterviewProtectionProps) {
  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!isActive) return;

      // 브라우저 경고 표시
      event.preventDefault();
      event.returnValue = ""; // Chrome requires returnValue to be set

      // Best-effort pause via sendBeacon
      // sendBeacon은 페이지 unload 시에도 요청을 보장하는 API
      const token = localStorage.getItem("token");
      if (token && interviewId) {
        const blob = new Blob([JSON.stringify({ interviewId })], {
          type: "application/json",
        });

        // sendBeacon은 POST 요청만 지원하므로 BFF endpoint 사용
        navigator.sendBeacon(`/api/v1/interviews/${interviewId}/pause`, blob);
      }
    },
    [isActive, interviewId],
  );

  useEffect(() => {
    if (!isActive) return;

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isActive, handleBeforeUnload]);

  // 명시적 pause 함수 (사용자가 직접 중지 버튼을 누를 때)
  const pauseInterview = useCallback(async () => {
    if (!isActive) return;

    try {
      await onPause();
    } catch (error) {
      console.error("Failed to pause interview:", error);
      throw error;
    }
  }, [isActive, onPause]);

  return { pauseInterview };
}
