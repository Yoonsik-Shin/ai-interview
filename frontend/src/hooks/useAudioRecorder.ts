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
  interviewSessionId: string,
  onChunk: (payload: {
    chunk: string | ArrayBuffer;
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
    // const b64 = toBase64(pcm); // Removed Base64 encoding
    chunkIdRef.current += 1;

    const now = Date.now();
    const chunkId = `c-${now}-${chunkIdRef.current}`;
    // console.log(`[AudioRecorder] Sending chunk ${chunkId}, size=${pcm.byteLength}, rate=${currentSrcRate}`);

    onChunkRef.current({
      chunk: pcm, // Send ArrayBuffer directly
      interviewSessionId,
      isFinal: false,
      format: "pcm16",
      sampleRate: TARGET_SAMPLE_RATE,
      chunkId,
    });
  }, [interviewSessionId]);

  const isMountedRef = useRef(true);

  const stop = useCallback(() => {
    isMountedRef.current = false;
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
      isMountedRef.current = true;
      setMicError(null);

      // Cleanup existing resources before starting new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }

      chunkIdRef.current = 0;
      bufferRef.current = [];
      totalRef.current = 0;
      try {
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

        // 비동기 호출 사이에 언마운트되거나 중지 요청이 있었다면 즉시 닫기
        if (!isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // 시스템 샘플 레이트 자동 감지 (기본값 사용)
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        sourceRef.current = src;

        const srcSamplesNeeded = Math.floor((ctx.sampleRate * CHUNK_MS) / 1000);
        console.log(
          `[AudioRecorder] Started. Context SampleRate: ${ctx.sampleRate}, Target Chunk Samples: ${srcSamplesNeeded}`,
        );

        // Audio Cleaning: Band-pass Filter (300Hz ~ 3400Hz)
        const highPass = ctx.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 300; // Remove low freq noise (rumble, pop)

        const lowPass = ctx.createBiquadFilter();
        lowPass.type = "lowpass";
        lowPass.frequency.value = 3400; // Remove high freq noise (hiss)

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

        // Connect nodes: Source -> HighPass -> LowPass -> Processor -> Gain -> Dest
        src.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(processor);
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
      chunk: new ArrayBuffer(0), // Empty buffer for final signal
      interviewSessionId,
      isFinal: true,
      format: "pcm16",
      sampleRate: TARGET_SAMPLE_RATE,
      chunkId,
    });
  }, [interviewSessionId]);

  return { start, stop, sendFinal, recording, micError };
}
