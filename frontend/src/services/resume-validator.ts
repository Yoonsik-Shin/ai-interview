import { pipeline, env } from "@xenova/transformers";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import { ResumeItem } from "../api/resumes";

// Skip local checks (we want to use the WASM backend)
env.allowLocalModels = false;
env.useBrowserCache = true;

// Worker 설정 - 로컬 worker 파일 사용 (CDN 404 에러 방지)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/**
 * 이력서 검증 결과 인터페이스
 */
export interface ValidationResult {
  isResume: boolean;
  score: number;
  reason?: string;
  source: "local" | "server";
  embedding?: number[];
  validationText?: string;
  isDuplicate?: boolean;
  duplicateSimilarity?: number;
  maxDuplicateSimilarity?: number; // Highest similarity found even if not a duplicate
  similarResumeId?: string;
  similarResumeTitle?: string;
}

// 싱글톤으로 파이프라인 인스턴스 관리
let embeddingPromise: Promise<any> | null = null;
const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

/**
 * 임베딩 모델 로딩 (최초 1회 수행, 중복 검사용)
 */
export async function preloadModel() {
  if (!embeddingPromise) {
    console.log(`[ResumeValidator] Loading model: ${MODEL_NAME}...`);
    embeddingPromise = pipeline("feature-extraction", MODEL_NAME, {
      quantized: false,
    });
  }
  return embeddingPromise;
}


/**
 * 코사인 유사도 계산
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    console.warn(
      `[ResumeValidator] Vector mismatch: A=${vecA?.length}, B=${vecB?.length}`,
    );
    return 0;
  }
  const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  const similarity =
    magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;

  // Debug log for low similarity despite exact match attempt
  if (similarity < 0.5) {
    // console.debug(`[ResumeValidator] Low similarity: ${similarity.toFixed(4)}`);
  }
  return similarity;
}

/**
 * PDF 텍스트 정규화 (한글 사이 공백 제거)
 */
function normalizeText(text: string): string {
  // NFC 정규화로 Mac(NFD) 유입 텍스트 일치화 (임베딩 정확도 향상)
  return (
    text
      .normalize("NFC")
      // Collapse all whitespaces into a single space
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * PII (민감 정보) 마스킹 처리
 */
export function maskPII(text: string): string {
  let masked = text;
  // Email
  masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  // SSN / 외국인등록번호: 000000-0000000 (전화번호보다 먼저 처리)
  masked = masked.replace(/[0-9]{6}-[0-9]{7}/g, "[SSN]");
  // Phone: 010-1234-5678, 010.1234.5678, 010 1234 5678 등
  masked = masked.replace(/(\d{2,3})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g, "[PHONE]");
  // 생년월일: "1996년 05월 04일" 또는 PDF 추출 시 공백 끼는 "1996 년 05 월 04 일" 형태 모두 처리
  masked = masked.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, "[DOB]");
  // 한국 주소: 시/도로 시작하는 주소
  masked = masked.replace(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n,]{5,40}/g, "[ADDRESS]");
  // 여권번호: 영문 1자 + 숫자 8자리
  masked = masked.replace(/\b[A-Z][0-9]{8}\b/g, "[PASSPORT]");
  // 운전면허번호: 12-35-123456-78
  masked = masked.replace(/\d{2}-\d{2}-\d{6}-\d{2}/g, "[DRIVER_LICENSE]");
  return masked;
}

/**
 * PDF 파일에서 텍스트 추출
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // CMap 설정 추가 (한글 등 특수문자 깨짐 방지)
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/cmaps/",
    cMapPacked: true,
  }).promise;
  let fullText = "";

  // 첫 2페이지만 확인해도 충분함
  const maxPages = Math.min(pdf.numPages, 2);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

/**
 * DOCX 파일에서 텍스트 추출
 */
async function extractTextFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * 파일이 이력서인지 LLM 서버로 판별
 * @param file 검증할 파일 객체
 * @param existingResumes 기존 이력서 목록 (중복 검사용)
 */
export async function validateResumeFile(
  file: File,
  _options?: unknown,
  existingResumes?: ResumeItem[],
): Promise<ValidationResult> {
  console.log(`[ResumeValidator] Validating file: ${file.name}`);

  let text = "";

  // 1. 텍스트 추출
  try {
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const validTypes = ["pdf", "docx", "txt"];
    if (!validTypes.includes(fileExt || "")) {
      return {
        isResume: false,
        score: 0,
        reason: "지원하지 않는 파일 형식입니다. (PDF, DOCX, TXT 지원)",
        source: "local",
      };
    }

    if (fileExt === "pdf") {
      text = await extractTextFromPDF(file);
    } else if (fileExt === "docx") {
      text = await extractTextFromDOCX(file);
    } else {
      text = await file.text();
    }

    // 2. 텍스트 정규화
    text = normalizeText(text);
    console.log(`[ResumeValidator] Text normalized (${text.length} chars)`);

    if (text.trim().length < 50) {
      return {
        isResume: false,
        score: 0,
        reason: "내용이 너무 짧습니다.",
        source: "local",
      };
    }
  } catch (e) {
    console.error("Text extraction failed:", e);
    return {
      isResume: false,
      score: 0,
      reason: "파일 내용을 읽을 수 없습니다.",
      source: "local",
    };
  }

  // 3. PII 마스킹 및 임베딩 생성 (중복 검사용)
  const maskedText = maskPII(text);

  // 간단한 해시 함수 (디버그용 - 백엔드와 비교)
  let textHash = 0;
  for (let i = 0; i < maskedText.length; i++) {
    textHash = (Math.imul(31, textHash) + maskedText.charCodeAt(i)) | 0;
  }

  console.log(
    `[ResumeValidator] Masked text (len: ${maskedText.length}, hash: ${textHash}) preview: "${maskedText.slice(0, 200)}"`,
  );
  let embedding: number[] = [];
  let maxDuplicateSimilarity: number | undefined = undefined;

  try {
    const extractor = await preloadModel();
    // 입력 텍스트 임베딩 생성 (앞부분 3000자만 사용 - 백엔드와 일치)
    const inputPreview = maskedText.slice(0, 3000);
    const output = await extractor(inputPreview, {
      pooling: "mean",
      normalize: true,
    });
    embedding = Array.from(output.data) as number[];
    console.log(
      `[ResumeValidator] Normalized text preview for embedding: "${inputPreview.slice(0, 100)}..."`,
    );

    // 셀프 테스트: 동일 텍스트로 다시 생성했을 때 1.0이 나오는지 확인
    const selfTestSimilarity = cosineSimilarity(embedding, embedding);
    console.log(
      `[ResumeValidator] Self-similarity check: ${selfTestSimilarity.toFixed(4)}`,
    );

    console.log(
      `[ResumeValidator] Embedding generated (dim: ${embedding.length}): [${embedding.slice(0, 5).join(", ")} ...]`,
    );

    // 4. 중복 검사 (서버 유효성 검사보다 우선 수행)
    if (existingResumes && existingResumes.length > 0) {
      console.log(
        `[ResumeValidator] Checking duplicates against ${existingResumes.length} existing resumes...`,
      );

      let maxSimilarity = 0;

      for (const resume of existingResumes) {
        if (resume.embedding && resume.embedding.length > 0) {
          console.log(
            `[ResumeValidator] Comparing with "${resume.title}" (dim: ${resume.embedding.length})`,
          );
          const similarity = cosineSimilarity(embedding, resume.embedding);
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
          }

          if (similarity >= 0.85) {
            console.warn(
              `[ResumeValidator] Duplicate detected! Similarity: ${similarity.toFixed(4)} with ${resume.title}`,
            );
            return {
              isResume: true,
              score: 1.0, // Existing resume is assumed to be a valid resume
              reason: `유사한 이력서가 이미 있습니다. (유사도: ${(similarity * 100).toFixed(1)}%, 대상: ${resume.title})`,
              source: "local",
              embedding,
              validationText: inputPreview,
              isDuplicate: true,
              duplicateSimilarity: similarity,
              maxDuplicateSimilarity: similarity,
              similarResumeId: resume.id,
              similarResumeTitle: resume.title,
            };
          }
        } else {
          console.debug(
            `[ResumeValidator] Skipping duplicate check for "${resume.title}" (no embedding)`,
          );
        }
      }
      console.log(
        `[ResumeValidator] Duplicate check pass. Max sim: ${maxSimilarity.toFixed(4)}`,
      );
      // Store maxSimilarity for UI feedback
      maxDuplicateSimilarity = maxSimilarity;
    } else {
      console.log(
        "[ResumeValidator] No existing resumes provided for duplicate check.",
      );
    }

    // 5. 서버 LLM 검증 (마스킹된 텍스트 사용)
    console.log("[ResumeValidator] Executing server-side validation...");
    const { validateContent } = await import("../api/resumes");
    const result = await validateContent(maskedText);

    return {
      ...result,
      source: "server",
      embedding,
      validationText: inputPreview,
      maxDuplicateSimilarity,
    };
  } catch (e: any) {
    console.error("AI Validation/Embedding Error:", e);
    let errorMessage = "AI 검증 실패 (임베딩 생성 불가)";
    if (e.message?.includes("fetch")) errorMessage = "AI 모델 다운로드 실패";
    else if (e.message?.includes("memory"))
      errorMessage = "메모리 부족으로 AI 검증 실패";

    return {
      isResume: true, // 일단 통과
      score: 0.5,
      reason: errorMessage,
      source: "local",
    };
  }
}
