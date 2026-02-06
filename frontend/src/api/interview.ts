import { api } from "./client";

export type InterviewType = "REAL" | "PRACTICE";

export type InterviewRole = "TECH" | "HR" | "LEADER";

export type InterviewPersonality = "PRESSURE" | "COMFORTABLE" | "RANDOM";

// 하위 호환성을 위해 유지 (UI 맵 등에서 사용)
export type InterviewPersona = InterviewRole | InterviewPersonality;

export type CreateInterviewReq = {
  resumeId?: string; // optional - 이력서 없이도 면접 가능
  domain: string;
  type: InterviewType;
  interviewerRoles: InterviewRole[];
  personality: InterviewPersonality;
  targetDurationMinutes: number;
  selfIntroduction: string;
};

export type CreateInterviewRes = { interviewId: string; status: string };

export async function createInterview(
  body: CreateInterviewReq,
): Promise<CreateInterviewRes> {
  return api<CreateInterviewRes>("/v1/interview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
