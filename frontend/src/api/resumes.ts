import { api } from "./client";

export type ResumeItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  embedding?: number[];
};

export type ResumeDetail = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  fileUrl?: string;
};

export type PresignedUrlRes = {
  uploadUrl: string;
  resumeId: string;
};

export type ListResumesRes = {
  resumes: ResumeItem[];
};

export type GetResumeRes = {
  resume: ResumeDetail;
};

export type DeleteResumeRes = {
  success: boolean;
  message: string;
};

export type CompleteUploadRes = {
  success: boolean;
};

export async function getUploadUrl(
  fileName: string,
  title: string,
): Promise<PresignedUrlRes> {
  return api<PresignedUrlRes>(
    `/v1/resumes/upload-url?fileName=${encodeURIComponent(fileName)}&title=${encodeURIComponent(title)}`,
  );
}

export async function uploadToPresignedUrl(
  url: string,
  file: File,
): Promise<void> {
  // Presigned URL은 별도의 인증 헤더가 필요 없으므로 기존 fetch 사용 가능 (혹은 api 함수에서 특정 조건 처리)
  // 여기서는 S3/MinIO로 직접 보내는 것이므로 기존 fetch를 유지하거나api를 수정해서 써야함.
  // api 함수는 기본적으로 json 헤더와 auth 헤더를 넣으므로 여기서는 raw fetch가 나음.
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

export async function completeUpload(
  resumeId: string,
  validationText?: string,
  embedding?: number[],
  existingResumeId?: string,
): Promise<CompleteUploadRes> {
  return api<CompleteUploadRes>("/v1/resumes/complete", {
    method: "POST",
    body: JSON.stringify({
      resumeId,
      validationText,
      embedding,
      existingResumeId,
    }),
  });
}

export async function listResumes(): Promise<ListResumesRes> {
  return api<ListResumesRes>("/v1/resumes");
}

export async function getResume(resumeId: string): Promise<GetResumeRes> {
  return api<GetResumeRes>(`/v1/resumes/${resumeId}`);
}

export async function validateContent(text: string): Promise<{
  isResume: boolean;
  score: number;
  reason: string;
}> {
  return api<{
    isResume: boolean;
    score: number;
    reason: string;
  }>("/v1/resumes/validate-content", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export const deleteResume = async (id: string): Promise<DeleteResumeRes> => {
  return api<DeleteResumeRes>(`/v1/resumes/${id}`, {
    method: "DELETE",
  });
};

export const retryResumeProcessing = async (id: string): Promise<{ success: boolean }> => {
  return api<{ success: boolean }>(`/v1/resumes/${id}/retry`, {
    method: "POST",
  });
};
