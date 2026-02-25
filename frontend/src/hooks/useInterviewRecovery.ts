import { useContext } from "react";
import { InterviewRecoveryContext } from "@/contexts/InterviewRecoveryContext";

/**
 * Layer 3: 세션 복구 체크 및 모달 제어 전역 훅
 */
export function useInterviewRecovery() {
  const context = useContext(InterviewRecoveryContext);

  if (context === undefined) {
    throw new Error(
      "useInterviewRecovery must be used within an InterviewRecoveryProvider",
    );
  }

  return context;
}
