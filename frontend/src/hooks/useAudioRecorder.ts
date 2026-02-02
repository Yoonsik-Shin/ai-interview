import { useCallback, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_MS = 500;
const SRC_RATE = 48000;
const SAMPLES_PER_CHUNK = Math.floor((TARGET_SAMPLE_RATE * CHUNK_MS) / 1000); // 8000

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

function toBase64(arr: ArrayBuffer): string {
  const u8 = new Uint8Array(arr);
  let b = "";
  for (let i = 0; i < u8.length; i++) b += String.fromCharCode(u8[i]!);
  return btoa(b);
}

export function useAudioRecorder(
  interviewSessionId: string,
  onChunk: (payload: {
    chunk: string;
    interviewSessionId: string;
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
    const srcSamplesNeeded = Math.floor((SRC_RATE * CHUNK_MS) / 1000);
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

    const resampled = resample16k(concat, SRC_RATE);
    const pcm = floatToPcm16(resampled);
    const b64 = toBase64(pcm);
    chunkIdRef.current += 1;
    const chunkId = `c-${Date.now()}-${chunkIdRef.current}`;
    onChunkRef.current({
      chunk: b64,
      interviewSessionId,
      isFinal: false,
      format: "pcm16",
      sampleRate: TARGET_SAMPLE_RATE,
      chunkId,
    });
  }, [interviewSessionId]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    sourceRef.current = null;
    processorRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    bufferRef.current = [];
    totalRef.current = 0;
    setRecording(false);
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      setMicError(null);
      chunkIdRef.current = 0;
      bufferRef.current = [];
      totalRef.current = 0;
      try {
        const constraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: SRC_RATE });
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
        src.connect(processor);
        processor.connect(gain);
        gain.connect(ctx.destination);
        setRecording(true);
      } catch (e) {
        setMicError(e instanceof Error ? e.message : "마이크 접근 실패");
      }
    },
    [flush],
  );

  const sendFinal = useCallback(() => {
    chunkIdRef.current += 1;
    const chunkId = `c-${Date.now()}-${chunkIdRef.current}-final`;
    onChunkRef.current({
      chunk: "",
      interviewSessionId,
      isFinal: true,
      format: "pcm16",
      sampleRate: TARGET_SAMPLE_RATE,
      chunkId,
    });
  }, [interviewSessionId]);

  return { start, stop, sendFinal, recording, micError };
}
