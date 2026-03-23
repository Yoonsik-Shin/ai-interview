import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  validateResumeFile,
  type ValidationResult,
} from "@/services/resume-validator";
import styles from "./ResumeUploadZone.module.css";

interface ResumeUploadZoneProps {
  onFileSelect: (file: File | null) => void;
  onAnalyzeStart?: () => void;
  onAnalyzeEnd?: (result: ValidationResult | null) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  className?: string;
  accept?: string;
  selectedFile?: File | null; // 외부에서 파일 상태 제어
  validationResult?: ValidationResult | null; // 외부에서 검증 결과 제어
  enableUpload?: boolean; // 업로드 버튼 활성화 (기본: false)
  onUploadComplete?: (resumeId: string) => void; // 업로드 완료 콜백
  existingResumes?: import("../api/resumes").ResumeItem[]; // 기존 이력서 목록
}

export function ResumeUploadZone({
  onFileSelect,
  onAnalyzeStart,
  onAnalyzeEnd,
  onError,
  onSuccess,
  className = "",
  accept = ".pdf,.doc,.docx",
  selectedFile: externalFile,
  validationResult: externalValidationResult,
  enableUpload = false,
  onUploadComplete,
  existingResumes,
}: ResumeUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [validationSource, setValidationSource] = useState<
    "local" | "server" | "none"
  >("none");
  const [capturedValidationText, setCapturedValidationText] = useState<
    string | null
  >(null);
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | null>(
    null,
  );
  const [currentValidationResult, setCurrentValidationResult] =
    useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 외부 파일 상태와 동기화
  useEffect(() => {
    if (externalFile === null) {
      // 외부에서 파일을 초기화하면 내부 상태도 초기화
      setSelectedFile(null);
      setAiScore(null);
      setValidationSource("none");
      setCapturedValidationText(null);
      setCapturedEmbedding(null);
    } else if (externalFile && !selectedFile) {
      // 외부에서 파일이 주어졌을 때 내부 상태 업데이트 (초기 로드 시)
      setSelectedFile(externalFile);
    }
  }, [externalFile, selectedFile]);

  // 외부 검증 결과와 동기화 (서버 검증 결과 반영)
  useEffect(() => {
    if (externalValidationResult) {
      setAiScore(externalValidationResult.score ?? null);
      setValidationSource(externalValidationResult.source);
      if (externalValidationResult.validationText) {
        setCapturedValidationText(externalValidationResult.validationText);
      }
      if (externalValidationResult.embedding) {
        setCapturedEmbedding(externalValidationResult.embedding);
      }
    }
  }, [externalValidationResult]);

  // 이력서 업데이트 함수
  const handleUpdate = useCallback(
    async (existingResumeId: string, file: File) => {
      setUploading(true);
      try {
        const { getUploadUrl, uploadToPresignedUrl, completeUpload } =
          await import("@/api/resumes");

        // 1. 업로드 URL 발급 (새로운 파일용)
        const { uploadUrl, resumeId: newTempId } = await getUploadUrl(
          file.name,
          file.name,
        );

        // 2. 스토리지에 직접 업로드
        await uploadToPresignedUrl(uploadUrl, file);

        // 3. 업로드 완료 알림 (기존 이력서 ID 포함)
        await completeUpload(
          newTempId,
          capturedValidationText || undefined,
          capturedEmbedding || undefined,
          existingResumeId,
        );

        onUploadComplete?.(existingResumeId);
        onSuccess?.("이력서가 성공적으로 업데이트되었습니다.");

        setSelectedFile(null);
        setAiScore(null);
        setValidationSource("none");
        setCapturedValidationText(null);
        setCapturedEmbedding(null);
        onFileSelect(null);
        setCurrentValidationResult(null);
      } catch (e) {
        console.error("Update error:", e);
        onError?.(e instanceof Error ? e.message : "업데이트 실패");
      } finally {
        setUploading(false);
      }
    },
    [
      onUploadComplete,
      onSuccess,
      onError,
      onFileSelect,
      capturedValidationText,
      capturedEmbedding,
    ],
  );

  // 중복 감지 공통 처리 함수 (인라인 UI 전환으로 상태만 유지)
  const processValidationResult = useCallback(
    async (validation: ValidationResult) => {
      return validation.isDuplicate;
    },
    [],
  );


  // 업로드 함수
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !enableUpload) return;
    setUploading(true);

    try {
      const { getUploadUrl, uploadToPresignedUrl, completeUpload } =
        await import("@/api/resumes");

      const { uploadUrl, resumeId } = await getUploadUrl(
        selectedFile.name,
        selectedFile.name,
      );
      await uploadToPresignedUrl(uploadUrl, selectedFile);
      await completeUpload(
        resumeId,
        capturedValidationText || undefined,
        capturedEmbedding || undefined,
      );

      onUploadComplete?.(resumeId);
      onSuccess?.("이력서가 성공적으로 업로드되었습니다.");

      // 성공 후 초기화
      setSelectedFile(null);
      setAiScore(null);
      setValidationSource("none");
      setCapturedValidationText(null);
      setCapturedEmbedding(null);
      onFileSelect(null);
      setCurrentValidationResult(null);
    } catch (e) {
      console.error("Upload error:", e);
      onError?.(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }, [
    selectedFile,
    enableUpload,
    capturedValidationText,
    capturedEmbedding,
    onUploadComplete,
    onSuccess,
    onError,
    onFileSelect,
  ]);

  // handleDeepVerify는 ResumeUploadZone 컴포넌트 내부에 정의되어야 하며,
  // setError와 Toast는 이 컴포넌트의 props나 context를 통해 제공되어야 합니다.
  // 현재 ResumeUploadZone에는 setError와 Toast가 정의되어 있지 않으므로,
  // 이 부분은 주석 처리하거나, ResumeManage 컴포넌트에서 사용될 것으로 가정합니다.
  /*
  const handleDeepVerify = useCallback(async () => {
    if (!selectedFile) return;

    setValidating(true);
    setError(""); // setError는 ResumeUploadZone의 state로 추가됨

    try {
      const result = await validateResumeFile(selectedFile);
      setValidationResult(result);

      if (result.isResume) {
        setError(""); // Clear any previous errors
        // 성공 메시지 표시 (Toast는 이 컴포넌트에 정의되어 있지 않음)
        // const successMsg = `✓ 서버 정밀 검증 통과 (신뢰도: ${(result.score * 100).toFixed(1)}%)`;
        // Toast.success(successMsg);
      } else {
        // 서버 검증도 실패 - 파일 초기화
        const failMsg = result.reason || "서버 검증에서도 이력서로 판단되지 않았습니다. 다른 파일을 선택해주세요.";
        setError(failMsg);
        // Toast.error(failMsg);
        setSelectedFile(null);
        setValidationResult(null);
      }
    } catch (e) {
      console.error(e);
      const errorMsg = "서버 검증 중 오류가 발생했습니다. 다시 시도해주세요.";
      setError(errorMsg);
      // Toast.error(errorMsg);
      // 에러 발생 시에도 파일 초기화
      setSelectedFile(null);
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  }, [selectedFile]);
  */

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    onFileSelect(null);
    setAiScore(null);
    setValidationSource("none");
    setCapturedValidationText(null);
    setCapturedEmbedding(null);
    setCurrentValidationResult(null);
    setValidating(false);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onAnalyzeEnd?.(null);
  }, [onFileSelect, onAnalyzeEnd]);

  const handleResumeFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().split(".").pop();
      const allowedExts = accept
        .split(",")
        .map((e) => e.replace(".", "").trim());

      if (!allowedExts.includes(ext || "")) {
        const errorMsg = `${accept} 파일만 업로드할 수 있습니다.`;
        onError?.(errorMsg);
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
      setAiScore(null);
      setValidationSource("none");
      setCapturedValidationText(null);
      setCapturedEmbedding(null);
      setCurrentValidationResult(null);

      onAnalyzeStart?.();
      setValidating(true);

      try {
        // 기본적으로 로컬 검증 수행
        const validation = await validateResumeFile(
          file,
          undefined,
          existingResumes,
        );
        setAiScore(validation.score ?? null);
        setValidationSource(validation.source);
        if (validation.validationText) {
          setCapturedValidationText(validation.validationText);
        }
        onAnalyzeEnd?.(validation);
        setCurrentValidationResult(validation);

        // 조기 리턴 제거 (인라인 UI에서 결과 노출을 위해 끝까지 진행)
        // const processed = await processValidationResult(validation);
        // if (processed) return;

        if (!validation.isResume) {
          const reason =
            validation.reason || "이력서 형식이 아닌 것으로 보입니다.";
          onError?.(reason);
        }
      } catch (e) {
        console.error("Selection validation failed:", e);
        onError?.("파일 분석 중 오류가 발생했습니다.");
        onAnalyzeEnd?.(null);
      } finally {
        setValidating(false);
      }
    },
    [
      accept,
      existingResumes,
      onAnalyzeStart,
      onAnalyzeEnd,
      onError,
      onFileSelect,
      processValidationResult,
    ],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("[ResumeUploadZone] handleFileChange triggered", file?.name);

    if (file) {
      handleResumeFile(file);
      // Reset input value to allow selecting the same file again
      if (e.target) {
        e.target.value = "";
      }
    } else {
      setSelectedFile(null);
      onFileSelect(null);
      setAiScore(null);
      setValidationSource("none");
      setCapturedValidationText(null);
      onAnalyzeEnd?.(null);
      setCurrentValidationResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleResumeFile(file);
    }
  };

  const v = externalValidationResult || currentValidationResult;

  return (
    <div className={`${styles.container} ${className}`}>
      <div
        className={`${styles.uploadBox} ${isDragging ? styles.dragging : ""} ${validating ? styles.validating : ""}`}
        onClick={() => {
          console.log(
            "[ResumeUploadZone] uploadBox clicked, triggering ref input click",
          );
          fileInputRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          id="resume-upload-input"
          type="file"
          className={styles.hiddenInput}
          accept={accept}
          onChange={handleFileChange}
        />
        <div className={styles.uploadIconWrapper}>
          <span className={styles.uploadIcon}>{validating ? "🔍" : "📄"}</span>
          {selectedFile && (
            <div className={styles.statusBar}>
              <span className={styles.fileName}>{selectedFile.name}</span>
              {validating && <span className={styles.analyzing}>분석 중…</span>}
              {!validating && aiScore !== null && (
                <div className={styles.validationResults}>
                  {/* Step 1: Duplicate Check Status - Only show if there are existing resumes to compare */}
                  {existingResumes && existingResumes.length > 0 && (
                    <div className={styles.validationStep}>
                      <span className={styles.stepLabel}>1. 중복 확인:</span>
                      <span
                        className={`${styles.stepValue} ${
                          (v?.maxDuplicateSimilarity || 0) < 0.85
                            ? styles.valueGood
                            : styles.valueWarn
                        }`}
                      >
                        {((v?.maxDuplicateSimilarity || 0) * 100).toFixed(1)}% (
                        {(v?.maxDuplicateSimilarity || 0) >= 0.85
                          ? "중복 발견"
                          : "유사함 없음"}
                        )
                      </span>
                    </div>
                  )}

                  {/* Step 2: Resume Relevance Status */}
                  <div className={styles.validationStep}>
                    <span className={styles.stepLabel}>
                      {existingResumes && existingResumes.length > 0
                        ? "2. 이력서 판별:"
                        : "이력서 적합도:"}
                    </span>
                    <span
                      className={`${styles.stepValue} ${
                        aiScore && aiScore >= 0.6
                          ? styles.valueGood
                          : styles.valueBad
                      }`}
                    >
                      {((aiScore || 0) * 100).toFixed(1)}% (
                      {aiScore && aiScore >= 0.6 ? "확인됨" : "적합도 낮음"})
                    </span>
                  </div>

                  {validationSource === "server" &&
                    aiScore &&
                    aiScore >= 0.5 && (
                      <div className={styles.serverSuccess}>
                        ✓ 서버 정밀 검증 완료
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
        <p className={styles.hint}>{accept.toUpperCase()} (최대 10MB)</p>

        {/* 로컬 AI 검증 실패 안내 메시지 */}
        {selectedFile &&
          aiScore !== null &&
          aiScore < 0.6 &&
          validationSource === "local" &&
          !validating && (
            <div className={styles.warningMessage}>
              <span className={styles.warningIcon}>⚠️</span>
              <div className={styles.warningText}>
                <strong>이력서가 아닌 것 같습니다.</strong>
                <p>
                  파일을 다시 확인해주시거나, 더 자세한 검증을 위해 아래 버튼을
                  눌러주세요.
                </p>
              </div>
            </div>
          )}

        {/* 서버 검증 버튼 (로컬 AI < 60% && 서버 검증 안 함) */}

        {/* 업로드 버튼 그룹 */}
        {selectedFile && aiScore !== null && !validating && !uploading && (
          <div className={styles.buttonGroup}>
            {/* 중복인 경우: 업데이트 / 새 등록 선택지 제공 */}
            {v?.isDuplicate && v.similarResumeId ? (
              <>
                <button
                  className={`${styles.uploadButton} ${styles.updateAction}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (v.similarResumeId)
                      handleUpdate(v.similarResumeId, selectedFile);
                  }}
                  disabled={uploading}
                >
                  <span style={{ fontSize: "1.25rem" }}>🔄</span>
                  <span>
                    {uploading ? "업데이트 중..." : "기존 이력서 업데이트"}
                  </span>
                </button>
                <button
                  className={`${styles.uploadButton} ${styles.forceAction}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                  disabled={uploading}
                >
                  <span style={{ fontSize: "1.25rem" }}>➕</span>
                  <span>새 이력서로 등록</span>
                </button>
              </>
            ) : (
              /* 중복이 아닌 경우: 일반 등록 버튼 (적합도 60% 이상일 때만) */
              aiScore >= 0.6 && (
                <button
                  className={styles.uploadButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                  disabled={uploading}
                >
                  <span style={{ fontSize: "1.25rem" }}>✓</span>
                  <span>{uploading ? "업로드 중..." : "이력서 등록하기"}</span>
                </button>
              )
            )}

            {/* 초기화(취소) 버튼 */}
            <button
              className={styles.resetButton}
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              disabled={uploading}
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
