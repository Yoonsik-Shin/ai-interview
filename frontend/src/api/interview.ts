import { api } from "./client";

export type InterviewType = "REAL" | "PRACTICE";
export type InterviewPersona =
  | "PRESSURE"
  | "COMFORTABLE"
  | "RANDOM"
  | "TECH"
  | "MAIN"
  | "HR";

export type CreateInterviewReq = {
  resumeId?: number; // optional - 이력서 없이도 면접 가능
  domain: string;
  type: InterviewType;
  persona: InterviewPersona;
  interviewerCount: number;
  targetDurationMinutes: number;
  selfIntroduction: string;
};

export type CreateInterviewRes = { interviewId: number; status: string };

export async function createInterview(
  body: CreateInterviewReq,
): Promise<CreateInterviewRes> {
  return api<CreateInterviewRes>("/v1/interview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
