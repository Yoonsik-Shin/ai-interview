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

export type InterviewSessionSummary = {
  interviewId: string;
  startedAt: string;
  status: string;
  domain: string;
  type: InterviewType;
  targetDurationMinutes: number;
  interviewerCount: number;
};

export type GetInterviewsRes = {
  interviews: InterviewSessionSummary[];
};

export async function createInterview(
  body: CreateInterviewReq,
): Promise<CreateInterviewRes> {
  return api<CreateInterviewRes>("/v1/interviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getInterviews(): Promise<GetInterviewsRes> {
  return api<GetInterviewsRes>("/v1/interviews", {
    method: "GET",
  });
}
