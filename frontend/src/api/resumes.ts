const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export type UploadResumeRes = { resumeId: number; message: string }

export async function uploadResume(
  file: File,
  title?: string
): Promise<UploadResumeRes> {
  const token = localStorage.getItem('accessToken')
  const form = new FormData()
  form.append('file', file)
  if (title) form.append('title', title)

  const res = await fetch(`${BASE}/v1/resumes/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<UploadResumeRes>
}
