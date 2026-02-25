import { useCallback, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_MS = 1010; // 1000ms보다 약간 여유를 두어 4096 블록 정합성 유도

function resample16k(src: Float32Array, srcRate: number): Float32Array {
  const ratio = srcRate / TARGET_SAMPLE_RATE;
  const dstLen = Math.floor(src.length / ratio);
  const dst = new Float32Array(dstLen);
  for (let i = 0; i < dstLen; i++) {
    const srcIdx = i * ratio;
    const a = Math.floor(srcIdx);
    const b = Math.min(a + 1, src.length - 1);
    const t = srcIdx - a;
    dst[i] = (src[a] ?? 0) * (1 - t) + (src[b] ?? 0) * t;
  }
  return dst;
}

function floatToPcm16(f32: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(f32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

// function toBase64(arr: ArrayBuffer): string {
//   const u8 = new Uint8Array(arr);
//   let b = "";
//   for (let i = 0; i < u8.length; i++) b += String.fromCharCode(u8[i]!);
//   return btoa(b);
// }

export function useAudioRecorder(
  interviewId: string,
  onChunk: (payload: {
    chunk: string | ArrayBuffer;
    interviewId: string;
    isFinal?: boolean;
    format?: string;
    sampleRate?: number;
    chunkId?: string;
  }) => void,
  options?: {
    onLevel?: (level: number, ts: number) => void;
  },
) {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunkIdRef = useRef(0);
  const bufferRef = useRef<Float32Array[]>([]);
  const totalRef = useRef(0);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const flush = useCallback(() => {
    if (!ctxRef.current) return;
    const currentSrcRate = ctxRef.current.sampleRate;
    const srcSamplesNeeded = Math.floor((currentSrcRate * CHUNK_MS) / 1000);

    const bufs = bufferRef.current;
    let n = 0;
    for (const b of bufs) n += b.length;

    if (n < srcSamplesNeeded) return;

    const concat = new Float32Array(srcSamplesNeeded);
    let written = 0;
    const nextBufs: Float32Array[] = [];
    for (const b of bufs) {
      if (written >= srcSamplesNeeded) {
        nextBufs.push(b);
        continue;
      }
      const take = Math.min(b.length, srcSamplesNeeded - written);
      concat.set(b.subarray(0, take), written);
      written += take;
      if (take < b.length) nextBufs.push(b.subarray(take));
    }
    bufferRef.current = nextBufs;
    totalRef.current = nextBufs.reduce((s, x) => s + x.length, 0);

    const resample = resample16k(concat, currentSrcRate);
    const pcm = floatToPcm16(resample);
    chunkIdRef.current += 1;

    const now = Date.now();
    const chunkId = `c-${now}-${chunkIdRef.current}`;

    onChunkRef.current({
      chunk: pcm,
      interviewId: interviewId,
      isFinal: false,
      format: "pcm16",
      sampleRate: TARGET_SAMPLE_RATE,
      chunkId,
    });
  }, [interviewId]);

  const isMountedRef = useRef(true);

  const isStartingRef = useRef(false);

  const stop = useCallback(async () => {
    isMountedRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    if (ctxRef.current) {
      if (ctxRef.current.state !== "closed") {
        await ctxRef.current.close().catch(() => {});
      }
      ctxRef.current = null;
    }
    bufferRef.current = [];
    totalRef.current = 0;
    setStream(null);
    setRecording(false);
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      isMountedRef.current = true;
      setMicError(null);

      try {
        // 기존 리소스 완전히 정리될 때까지 대기
        await stop();
        isMountedRef.current = true;

        const baseAudioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        const constraints: MediaStreamConstraints = {
          audio: deviceId
            ? { deviceId: { exact: deviceId }, ...baseAudioConstraints }
            : baseAudioConstraints,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setStream(stream);

        // 16kHz 강제 지정을 통해 샘플 레이트 불일치 방어
        const ctx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )({ sampleRate: TARGET_SAMPLE_RATE });

        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        sourceRef.current = src;

        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input.length);
          copy.set(input);
          if (options?.onLevel) {
            let sum = 0;
            for (let i = 0; i < input.length; i++) {
              const v = input[i] ?? 0;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / input.length);
            options.onLevel(rms, performance.now());
          }
          bufferRef.current.push(copy);
          totalRef.current += copy.length;
          flush();
        };

        const gain = ctx.createGain();
        gain.gain.value = 0;

        // 원음 중심 연결: 필터 제거 (브라우저의 기본 처리를 신뢰)
        src.connect(processor);
        processor.connect(gain);
        gain.connect(ctx.destination);
        setRecording(true);
        return stream;
      } catch (e) {
        setMicError(e instanceof Error ? e.message : "마이크 접근 실패");
        return undefined;
      } finally {
        isStartingRef.current = false;
      }
    },
    [flush, options, stop],
  );

  const sendFinal = useCallback(() => {
    chunkIdRef.current += 1;
    const chunkId = `c-${Date.now()}-${chunkIdRef.current}-final`;
    onChunkRef.current({
      chunk: new ArrayBuffer(0),
      interviewId: interviewId,
      isFinal: true,
      format: "pcm16",
      sampleRate: TARGET_SAMPLE_RATE,
      chunkId,
    });
  }, [interviewId]);

  return {
    start,
    stop,
    sendFinal,
    recording,
    micError,
    stream,
  };
}
