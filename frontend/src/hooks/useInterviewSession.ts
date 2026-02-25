import { useEffect, useCallback } from "react";
import { InterviewStage } from "./useInterviewSocket";

interface InterviewSessionData {
  interviewId: string;
  stage: InterviewStage;
  timestamp: number;
}

const STORAGE_KEY = "activeInterview";
const UPDATE_INTERVAL = 10000; // 10초마다 업데이트

/**
 * Layer 2: LocalStorage 세션 추적
 *
 * 면접 진행 중 주기적으로 세션 정보를 localStorage에 저장:
 * - 면접 ID
 * - 현재 단계
 * - 마지막 업데이트 시간
 *
 * 면접 완료/취소 시 자동으로 제거
 */
export function useInterviewSession(
  interviewId: string | null,
  currentStage: InterviewStage | null,
  isActive: boolean,
) {
  // 세션 정보 저장
  const saveSession = useCallback(() => {
    if (!interviewId || !currentStage || !isActive) return;

    const sessionData: InterviewSessionData = {
      interviewId,
      stage: currentStage,
      timestamp: Date.now(),
    };

    console.log("SessionStorage: Saving session to localStorage", sessionData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  }, [interviewId, currentStage, isActive]);

  // 세션 정보 제거
  const clearSession = useCallback(() => {
    console.log("SessionStorage: Clearing session from localStorage");
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 주기적으로 세션 정보 업데이트
  useEffect(() => {
    if (!isActive) return;

    // 즉시 저장
    saveSession();

    // 주기적 업데이트
    const intervalId = setInterval(saveSession, UPDATE_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isActive, saveSession]);

  // 면접 완료/취소 시 세션 정보 제거
  useEffect(() => {
    if (currentStage === InterviewStage.COMPLETED) {
      clearSession();
    }
  }, [currentStage, clearSession]);

  return { saveSession, clearSession };
}

/**
 * 저장된 세션 정보 조회
 */
export function getStoredSession(): InterviewSessionData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as InterviewSessionData;

    // 24시간 초과 시 무시
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to parse stored session:", error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
