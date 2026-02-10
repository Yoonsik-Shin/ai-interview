import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import styles from "./PremiumResumeViewer.module.css";

// PDF.js worker 설정 (Vite 전용 로컬 워커)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PremiumResumeViewerProps {
  fileUrl: string;
}

export const PremiumResumeViewer: React.FC<PremiumResumeViewerProps> = ({
  fileUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const isRenderingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [fileType, setFileType] = useState<"pdf" | "docx" | "other">("other");
  const [docxHtml, setDocxHtml] = useState<string>("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [rotation, setRotation] = useState(0);

  // renderPage 함수를 먼저 정의 (useCallback 사용)
  const renderPage = useCallback(
    async (
      pdf: any,
      pageNum: number,
      currentScale: number,
      currentRotation: number,
    ) => {
      if (!canvasRef.current) {
        console.log("[PDF Debug] Canvas ref is null");
        return;
      }

      // Wait if already rendering
      if (isRenderingRef.current) {
        // Cancel the ongoing task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
        // Wait a bit for cancellation to complete
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      isRenderingRef.current = true;

      try {
        const page = await pdf.getPage(pageNum);

        // PDF.js v5.x+ 에서는 getViewport() 호출 시 page.rotate가 이미 고려됩니다.
        // 여기에 다시 page.rotate를 더하면 회전이 중복 적용되어 뒤집히는 문제가 발생합니다.
        // 따라서 사용자 지정 회전값(currentRotation)만 반영합니다.
        const totalRotation = currentRotation % 360;

        console.log(
          "[PDF Debug] Page:",
          pageNum,
          "Original Rotation:",
          page.rotate,
          "User Rotation:",
          currentRotation,
          "Total:",
          totalRotation,
        );

        const viewport = page.getViewport({
          scale: currentScale,
          rotation: totalRotation,
        });

        console.log(
          "[PDF Debug] Viewport size:",
          viewport.width,
          "x",
          viewport.height,
        );

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!canvas || !context) {
          console.error("[PDF Debug] Canvas or context is null");
          isRenderingRef.current = false;
          return;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;

        console.log("[PDF Debug] Render complete");
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") {
          console.log("[PDF Debug] Rendering cancelled");
        } else {
          console.error("[PDF Debug] Render error:", err);
        }
      } finally {
        isRenderingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    // Effect 시작 시 mounted 상태로 재설정
    isMountedRef.current = true;

    const detectFileType = () => {
      const url = fileUrl.toLowerCase();
      if (url.includes(".pdf") || url.includes("pdf")) return "pdf";
      if (url.includes(".doc")) return "docx";
      return "other";
    };

    const type = detectFileType();
    setFileType(type);
    setLoading(true);
    setError(null);
    setPageNumber(1);
    setRotation(0); // 파일 변경 시 회전 초기화
    initialLoadDoneRef.current = false;

    const loadFile = async () => {
      try {
        console.log("[PDF Debug] loadFile started, type:", type);
        if (type === "pdf") {
          console.log("[PDF Debug] Loading PDF from:", fileUrl);
          // CMap 설정 포함하여 PDF 로드 (한글 폰트 지원)
          const loadingTask = pdfjsLib.getDocument({
            url: fileUrl,
            cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
            cMapPacked: true,
          });
          const pdf = await loadingTask.promise;

          console.log("[PDF Debug] PDF loaded, pages:", pdf.numPages);

          if (!isMountedRef.current) {
            console.log("[PDF Debug] Component unmounted, aborting");
            return;
          }

          setPdfDoc(pdf);
          setNumPages(pdf.numPages);

          console.log("[PDF Debug] Calling renderPage...");
          await renderPage(pdf, 1, scale, 0);
          console.log("[PDF Debug] renderPage completed");
        } else if (type === "docx") {
          const response = await fetch(fileUrl);
          const arrayBuffer = await response.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setDocxHtml(result.value);
        }
        if (isMountedRef.current) {
          setLoading(false);
          initialLoadDoneRef.current = true;
        }
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") return;
        console.error("File load error:", err);
        setError("문서를 불러오는 중 오류가 발생했습니다.");
        setLoading(false);
        initialLoadDoneRef.current = true;
      }
    };

    loadFile();

    return () => {
      isMountedRef.current = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      isRenderingRef.current = false;
      initialLoadDoneRef.current = false;
    };
  }, [fileUrl, renderPage]); // renderPage 의존성 추가

  // Separate effect for scale, page, and rotation changes - only run after initial load
  useEffect(() => {
    if (
      pdfDoc &&
      !loading &&
      fileType === "pdf" &&
      initialLoadDoneRef.current
    ) {
      renderPage(pdfDoc, pageNumber, scale, rotation);
    }
  }, [scale, pageNumber, rotation, pdfDoc, loading, fileType, renderPage]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));
  const handlePrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () =>
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className={styles.viewerContainer} ref={containerRef}>
      {loading && (
        <div className={styles.skeletonOverlay}>
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonBody} />
        </div>
      )}

      {error && <div className={styles.errorState}>{error}</div>}

      {!loading && !error && (
        <div className={styles.topToolbar}>
          <div className={styles.toolbarGroup}>
            <button onClick={handleZoomOut} className={styles.toolBtn}>
              ➖
            </button>
            <span className={styles.toolLabel}>{Math.round(scale * 100)}%</span>
            <button onClick={handleZoomIn} className={styles.toolBtn}>
              ➕
            </button>
          </div>

          {fileType === "pdf" && <div className={styles.toolbarDivider} />}

          {fileType === "pdf" && (
            <>
              <div className={styles.toolbarGroup}>
                <button
                  onClick={handlePrevPage}
                  disabled={pageNumber === 1}
                  className={styles.toolBtn}
                >
                  ◀
                </button>
                <span className={styles.toolLabel}>
                  {pageNumber} / {numPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={pageNumber === numPages}
                  className={styles.toolBtn}
                >
                  ▶
                </button>
              </div>

              <div className={styles.toolbarDivider} />

              <div className={styles.toolbarGroup}>
                <button
                  onClick={handleRotate}
                  className={styles.toolBtn}
                  title="90도 회전"
                >
                  ⟳
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.scrollArea}>
        {fileType === "pdf" ? (
          <canvas ref={canvasRef} className={styles.pdfCanvas} />
        ) : (
          <div
            className={styles.docxContent}
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        )}
      </div>
    </div>
  );
};
