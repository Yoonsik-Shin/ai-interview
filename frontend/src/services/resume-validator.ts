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
// const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
// Using a slightly smaller/faster model for browser if possible,
// but sticking to the requested verified model.
const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

/**
 * 모델 로딩 (최초 1회 수행)
 */
export async function preloadModel() {
  if (!embeddingPromise) {
    console.log(`[ResumeValidator] Loading model: ${MODEL_NAME}...`);
    embeddingPromise = pipeline("feature-extraction", MODEL_NAME, {
      quantized: false, // Use full precision to match Python
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

// 이력서 판단 기준 앵커 텍스트 (실제 이력서 형식에 가까운 샘플로 변경)
const ANCHOR_TEXT = `
이력서

[경력]
소프트웨어 엔지니어, ABC 회사, 2020-2023
- 웹 애플리케이션 개발 및 유지보수
- React, Node.js, TypeScript 등을 활용한 프로젝트 수행

[학력]
컴퓨터공학과, XYZ 대학교, 2016-2020

[프로젝트]
AI 면접 시스템 개발 (2023)
- 기술 스택: Python, FastAPI, React, PostgreSQL
- 음성 인식 및 자연어 처리 기술 활용

[기술 스택]
- 프로그래밍 언어: Python, JavaScript, TypeScript, Java
- 프레임워크: React, Node.js, Spring Boot
- 데이터베이스: PostgreSQL, MongoDB, Redis

Resume Curriculum Vitae Experience Education Skills Projects
`;

let anchorEmbedding: number[] | null = null;

async function getAnchorEmbedding(extractor: any): Promise<number[]> {
  if (anchorEmbedding) return anchorEmbedding;

  console.log(
    `[ResumeValidator] Generating anchor embedding from text (${ANCHOR_TEXT.length} chars)...`,
  );
  // Normalize anchor text to match the input text logic
  const normalizedAnchor = normalizeText(ANCHOR_TEXT);
  const output = await extractor(normalizedAnchor, {
    pooling: "mean",
    normalize: true,
  });
  anchorEmbedding = Array.from(output.data);
  console.log(
    `[ResumeValidator] Anchor embedding generated: ${anchorEmbedding.length} dimensions`,
  );
  return anchorEmbedding!;
}

/**
 * PDF 텍스트 정규화 (한글 사이 공백 제거)
 */
function normalizeText(text: string): string {
  // NFC 정규화로 Mac(NFD) 유입 텍스트 일치화 (임베딩 정확도 향상)
  return (
    text
      .normalize("NFC")
      // Remove all spaces between Korean characters (e.g., '가 나 다' -> '가나다')
      .replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "")
      // Add single space between Korean and English/Numbers
      .replace(/([가-힣])\s+([a-zA-Z0-9])/g, "$1 $2")
      .replace(/([a-zA-Z0-9])\s+([가-힣])/g, "$1 $2")
      // Collapse all other whitespaces into a single space
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
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  masked = masked.replace(emailRegex, "[EMAIL]");
  // Phone: 010-1234-5678, 010.1234.5678, 010 1234 5678, 01012345678 etc
  const phoneRegex = /(\d{2,3})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g;
  masked = masked.replace(phoneRegex, "[PHONE]");
  // SSN: 000000-0000000
  const ssnRegex = /[0-9]{6}-[0-9]{7}/g;
  masked = masked.replace(ssnRegex, "[SSN]");
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
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
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
 * 파일이 이력서인지 로컬 AI로 판별 (임베딩 유사도 방식)
 * @param file 검증할 파일 객체
 * @param options 옵션 (forceServer 등)
 */

/**
 * 파일이 이력서인지 로컬 AI로 판별 (임베딩 유사도 방식)
 * @param file 검증할 파일 객체
 * @param options 옵션 (forceServer 등)
 * @param existingResumes 기존 이력서 목록 (중복 검사용)
 */
// ... (imports and setups unchanged)

/**
 * 파일이 이력서인지 로컬 AI로 판별 (임베딩 유사도 방식)
 * @param file 검증할 파일 객체
 * @param options 옵션 (forceServer 등)
 * @param existingResumes 기존 이력서 목록 (중복 검사용)
 */
export async function validateResumeFile(
  file: File,
  options?: { forceServer?: boolean },
  existingResumes?: ResumeItem[],
): Promise<ValidationResult> {
  console.log(`[ResumeValidator] Validating file: ${file.name}`, options);

  let text = "";

  // 1. 텍스트 추출
  try {
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const validTypes = ["pdf", "docx", "txt"];
    if (!validTypes.includes(fileExt || "")) {
      if (!options?.forceServer) {
        return {
          isResume: false,
          score: 0,
          reason: "지원하지 않는 파일 형식입니다. (PDF, DOCX, TXT 지원)",
          source: "local",
        };
      }
    }

    if (fileExt === "pdf") {
      text = await extractTextFromPDF(file);
    } else if (fileExt === "docx") {
      text = await extractTextFromDOCX(file);
    } else if (fileExt === "txt") {
      text = await file.text();
    } else if (options?.forceServer) {
      throw new Error("지원하지 않는 파일 형식입니다.");
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

    // 5. 서버 유효성 검증 (중복이 아닌 경우에만 진행)
    if (options?.forceServer) {
      console.log("[ResumeValidator] Executing server-side validation...");
      const { validateContent } = await import("../api/resumes");
      const result = await validateContent(text);

      return {
        ...result,
        source: "server",
        embedding,
        validationText: inputPreview,
        maxDuplicateSimilarity,
      };
    }

    // 6. 로컬 이력서 판단 (서버 검증 안 한 경우)
    const anchorVec = await getAnchorEmbedding(extractor);
    const similarity = cosineSimilarity(embedding, anchorVec);
    const THRESHOLD = 0.6;
    const isResume = similarity >= THRESHOLD;

    return {
      isResume,
      score: similarity,
      reason: isResume
        ? undefined
        : `이력서 양식이 아닌 것 같습니다. (유사도: ${(similarity * 100).toFixed(1)}%)`,
      source: "local",
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
// End of function // End of function
