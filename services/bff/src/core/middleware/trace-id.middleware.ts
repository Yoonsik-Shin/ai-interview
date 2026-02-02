import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Trace ID 미들웨어
 *
 * - 요청에 traceId를 부여하고, 응답 헤더에 반환합니다.
 * - 이후 로깅/모니터링에서 Correlation ID로 활용됩니다.
 */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    let traceId = (req.headers["x-trace-id"] as string | undefined) ?? null;

    if (!traceId) {
        traceId = randomUUID();
    }

    (req as any).traceId = traceId;
    res.setHeader("x-trace-id", traceId);

    // 헬스 체크 경로는 로깅에서 제외
    const ignoredPaths = [
        "/api/health/liveness",
        "/api/health/readiness",
        "/health/liveness",
        "/health/readiness",
    ];
    if (!ignoredPaths.includes(req.url)) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - TraceID: ${traceId}`);
    }

    next();
}
