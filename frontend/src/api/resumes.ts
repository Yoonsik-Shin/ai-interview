const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type ResumeItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export type ResumeDetail = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
};

export type UploadResumeRes = { resumeId: string; message: string };

export type PresignedUrlRes = {
  uploadUrl: string;
  resumeId: string;
};

export async function getUploadUrl(
  fileName: string,
  title: string,
): Promise<PresignedUrlRes> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(
    `${BASE}/v1/resumes/upload-url?fileName=${encodeURIComponent(fileName)}&title=${encodeURIComponent(title)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function uploadToPresignedUrl(
  url: string,
  file: File,
): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

export async function completeUpload(resumeId: string): Promise<void> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${BASE}/v1/resumes/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ resumeId }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Completion failed: ${res.status}`);
}

export async function uploadResume(
  file: File,
  title?: string,
): Promise<UploadResumeRes> {
  const token = localStorage.getItem("accessToken");
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);

  const res = await fetch(`${BASE}/v1/resumes/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<UploadResumeRes>;
}

export async function listResumes(): Promise<ResumeItem[]> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${BASE}/v1/resumes`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.resumes ?? [];
}

export async function getResume(id: string): Promise<ResumeDetail> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${BASE}/v1/resumes/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
