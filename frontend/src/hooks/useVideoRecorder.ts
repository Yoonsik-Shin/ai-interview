import { useRef, useCallback, useEffect } from "react";
import {
    saveSegmentMeta,
    appendChunk,
    getChunks,
    deleteSegment,
    getPendingSegments,
} from "@/lib/recordingStorage";

const UPLOAD_RETRY_DELAYS = [1000, 3000, 7000];

async function uploadWithRetry(uploadUrl: string, blob: Blob): Promise<boolean> {
    const isAzure = uploadUrl.includes("blob.core.windows.net");
    const headers: Record<string, string> = {
        "Content-Type": "video/webm",
        ...(isAzure ? { "x-ms-blob-type": "BlockBlob" } : {}),
    };

    for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS.length; attempt++) {
        try {
            const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers });
            if (res.ok) return true;
            console.warn(`Upload attempt ${attempt + 1} failed: HTTP ${res.status}`);
        } catch (err) {
            console.warn(`Upload attempt ${attempt + 1} error:`, err);
        }
        if (attempt < UPLOAD_RETRY_DELAYS.length) {
            await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAYS[attempt]));
        }
    }
    return false;
}

async function fetchUploadUrl(
    interviewId: string,
    turnCount: number,
): Promise<{ uploadUrl: string; objectKey: string }> {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(
        `/api/v1/interviews/${interviewId}/recording-segments/upload-url?turn=${turnCount}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new Error(`Failed to get upload URL: HTTP ${res.status}`);
    return res.json();
}

async function notifyComplete(
    interviewId: string,
    objectKey: string,
    turnCount: number,
    durationSeconds?: number,
    startedAtEpoch?: number,
    endedAtEpoch?: number,
): Promise<void> {
    const token = localStorage.getItem("accessToken");
    await fetch(`/api/v1/interviews/${interviewId}/recording-segments/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            objectKey,
            turnCount,
            durationSeconds,
            startedAtEpoch,
            endedAtEpoch,
        }),
    });
}

interface ActiveSegment {
    turnCount: number;
    uploadUrl: string;
    objectKey: string;
    startedAtEpoch: number;
}

export function useVideoRecorder(
    interviewId: string | null,
    streamRef: React.RefObject<MediaStream | null>,
) {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunkIndexRef = useRef(0);
    const activeSegmentRef = useRef<ActiveSegment | null>(null);

    const startSegment = useCallback(
        async (turnCount: number) => {
            if (!interviewId) return;
            const stream = streamRef.current;
            if (!stream) return;
            if (mediaRecorderRef.current?.state === "recording") return;

            try {
                const { uploadUrl, objectKey } = await fetchUploadUrl(interviewId, turnCount);
                const expiresAt = Date.now() + 600_000;

                await saveSegmentMeta({
                    interviewId,
                    turnCount,
                    uploadUrl,
                    objectKey,
                    expiresAt,
                    status: "recording",
                });

                chunkIndexRef.current = 0;
                activeSegmentRef.current = {
                    turnCount,
                    uploadUrl,
                    objectKey,
                    startedAtEpoch: Date.now(),
                };

                const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
                    ? "video/webm;codecs=vp8,opus"
                    : "video/webm";

                const recorder = new MediaRecorder(stream, { mimeType });

                recorder.ondataavailable = async (e) => {
                    if (e.data.size === 0) return;
                    const idx = chunkIndexRef.current++;
                    await appendChunk(interviewId, turnCount, idx, e.data);
                };

                mediaRecorderRef.current = recorder;
                recorder.start(2000);
            } catch (err) {
                console.error("startSegment error:", err);
            }
        },
        [interviewId, streamRef],
    );

    const stopSegment = useCallback(async () => {
        const recorder = mediaRecorderRef.current;
        const active = activeSegmentRef.current;
        if (!recorder || recorder.state === "inactive" || !active || !interviewId) return;

        const endedAtEpoch = Date.now();

        // Stop recorder and wait for final ondataavailable flush
        await new Promise<void>((resolve) => {
            const original = recorder.onstop;
            recorder.onstop = (e) => {
                if (original) (original as EventListener)(e);
                resolve();
            };
            recorder.stop();
        });

        mediaRecorderRef.current = null;
        activeSegmentRef.current = null;

        const { turnCount, uploadUrl, objectKey, startedAtEpoch } = active;
        const durationSeconds = Math.round((endedAtEpoch - startedAtEpoch) / 1000);

        try {
            await saveSegmentMeta({
                interviewId,
                turnCount,
                uploadUrl,
                objectKey,
                expiresAt: Date.now() + 600_000,
                status: "pending",
            });

            const chunks = await getChunks(interviewId, turnCount);
            if (chunks.length === 0) {
                await deleteSegment(interviewId, turnCount);
                return;
            }

            const blob = new Blob(chunks, { type: "video/webm" });
            const ok = await uploadWithRetry(uploadUrl, blob);
            if (ok) {
                await notifyComplete(
                    interviewId,
                    objectKey,
                    turnCount,
                    durationSeconds,
                    startedAtEpoch,
                    endedAtEpoch,
                );
                await deleteSegment(interviewId, turnCount);
            }
        } catch (err) {
            console.error("stopSegment error:", err);
        }
    }, [interviewId]);

    const recoverPendingUploads = useCallback(async () => {
        if (!interviewId) return;
        try {
            const pending = await getPendingSegments();
            for (const seg of pending.filter((s) => s.interviewId === interviewId)) {
                const chunks = await getChunks(seg.interviewId, seg.turnCount);
                if (chunks.length === 0) {
                    await deleteSegment(seg.interviewId, seg.turnCount);
                    continue;
                }

                let { uploadUrl, objectKey } = seg;

                if (Date.now() > seg.expiresAt - 30_000) {
                    try {
                        const fresh = await fetchUploadUrl(seg.interviewId, seg.turnCount);
                        uploadUrl = fresh.uploadUrl;
                        objectKey = fresh.objectKey;
                    } catch {
                        continue;
                    }
                }

                const blob = new Blob(chunks, { type: "video/webm" });
                const ok = await uploadWithRetry(uploadUrl, blob);
                if (ok) {
                    await notifyComplete(seg.interviewId, objectKey, seg.turnCount);
                    await deleteSegment(seg.interviewId, seg.turnCount);
                }
            }
        } catch (err) {
            console.error("recoverPendingUploads error:", err);
        }
    }, [interviewId]);

    // pagehide: flush current recording chunks to IndexedDB (best-effort)
    useEffect(() => {
        const handler = () => {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state === "recording") {
                if (activeSegmentRef.current && interviewId) {
                    saveSegmentMeta({ interviewId, ...activeSegmentRef.current, expiresAt: Date.now() + 600_000, status: "pending" }).catch(() => {});
                }
                recorder.stop();
            }
        };
        window.addEventListener("pagehide", handler);
        return () => window.removeEventListener("pagehide", handler);
    }, []);

    return { startSegment, stopSegment, recoverPendingUploads };
}
