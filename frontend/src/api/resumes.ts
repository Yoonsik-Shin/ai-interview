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

export type SimilarResumeInfo = {
  existingResumeId: string;
  similarity: number;
  title: string;
  uploadedAt: string;
};

export type UploadResumeRes = {
  resumeId?: string;
  message?: string;
  similarResume?: SimilarResumeInfo;
};

export type PresignedUrlRes = {
  uploadUrl: string;
  resumeId: string;
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
): Promise<void> {
  return api<void>("/v1/resumes/complete", {
    method: "POST",
    body: JSON.stringify({ resumeId, validationText, embedding }),
  });
}

/**
 * Legacy 방식: 파일을 직접 BFF로 전송 (유사도 검증 포함)
 */
export async function uploadResumeLegacy(
  file: File,
  title: string,
  forceUpload = false,
  validationText?: string,
  embedding?: number[],
): Promise<UploadResumeRes> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("forceUpload", String(forceUpload));
  if (validationText) formData.append("validationText", validationText);
  if (embedding) formData.append("embedding", JSON.stringify(embedding));

  const res = await fetch("/api/v1/resumes/upload-legacy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Upload failed: ${res.status}`);
  }

  return res.json();
}

/**
 * 기존 이력서 업데이트
 */
export async function updateResume(
  existingResumeId: string,
  file: File,
  title: string,
  validationText?: string,
  embedding?: number[],
): Promise<{ resumeId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("existingResumeId", existingResumeId);
  if (validationText) formData.append("validationText", validationText);
  if (embedding) formData.append("embedding", JSON.stringify(embedding));

  const res = await fetch("/api/v1/resumes/update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Update failed: ${res.status}`);
  }

  return res.json();
}

export async function listResumes(): Promise<ResumeItem[]> {
  return api<ResumeItem[]>("/v1/resumes");
}

export async function getResume(resumeId: string): Promise<ResumeDetail> {
  return api<ResumeDetail>(`/v1/resumes/${resumeId}`);
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

export const deleteResume = async (id: string) => {
  return api(`/v1/resumes/${id}`, {
    method: "DELETE",
  });
};
