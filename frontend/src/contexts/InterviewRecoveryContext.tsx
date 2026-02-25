import { createContext, useState, useCallback, ReactNode } from "react";
import { client } from "@/api/client";
import { getInterviews } from "@/api/interview";

interface RecoveryData {
  interviewId: string;
  stage: string;
  status: string;
  timestamp: number;
}

interface InterviewRecoveryContextType {
  showModal: boolean;
  recoveryData: RecoveryData | null;
  isChecking: boolean;
  triggerRecoveryCheck: () => Promise<boolean>;
  dismissModal: () => void;
}

export const InterviewRecoveryContext = createContext<
  InterviewRecoveryContextType | undefined
>(undefined);

export function InterviewRecoveryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [showModal, setShowModal] = useState(false);
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const triggerRecoveryCheck = useCallback(async (): Promise<boolean> => {
    console.log("Recovery Check: Triggered by user (API-based)");
    setIsChecking(true);
    try {
      // 1. 진행 중인 면접 조회 (최신순 1개)
      const { interviews } = await getInterviews({
        status: "IN_PROGRESS,PAUSED",
        limit: 1,
        sort: "desc",
      });

      console.log("Recovery Check: API search result", interviews);

      if (interviews.length === 0) {
        console.log("Recovery Check: No active sessions found");
        setIsChecking(false);
        return false;
      }

      const latestInterview = interviews[0];
      console.log("Recovery Check: Found active session", latestInterview);

      // 2. 상세 정보 조회 (Stage 정보 필요)
      const detailResponse = await client.get<{
        status: string;
        currentStage: string;
      }>(`/v1/interviews/${latestInterview.interviewId}`);

      console.log("Recovery Check: Detailed info", detailResponse);

      setRecoveryData({
        interviewId: latestInterview.interviewId,
        stage: detailResponse.currentStage,
        status: detailResponse.status,
        timestamp: new Date(latestInterview.startedAt).getTime(),
      });
      setShowModal(true);
      return true;
    } catch (error) {
      console.error("Recovery check failed:", error);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const dismissModal = useCallback(() => {
    localStorage.removeItem("activeInterview");
    setShowModal(false);
    setRecoveryData(null);
  }, []);

  return (
    <InterviewRecoveryContext.Provider
      value={{
        showModal,
        recoveryData,
        isChecking,
        triggerRecoveryCheck,
        dismissModal,
      }}
    >
      {children}
    </InterviewRecoveryContext.Provider>
  );
}
