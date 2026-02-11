import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Trace ID 미들웨어
 *
 * - 요청에 traceId를 부여하고, 응답 헤더에 반환합니다.
 * - 이후 로깅/모니터링에서 Correlation ID로 활용됩니다.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
    private readonly logger = new Logger(TraceIdMiddleware.name);

    use(req: Request, res: Response, next: NextFunction) {
        const rawTraceId = req.headers["x-trace-id"];
        const candidate = Array.isArray(rawTraceId) ? rawTraceId[0] : rawTraceId;
        const traceId = candidate ?? randomUUID();

        req.traceId = traceId;
        res.setHeader("x-trace-id", traceId);

        const path = req.originalUrl;
        if (!this.getIgnoredPaths().includes(path)) {
            this.logger.log(`${req.method} ${path} - TraceID: ${traceId}`);
        }

        next();
    }

    private getIgnoredPaths(): string[] {
        return [
            "/",
            "/api/health/liveness",
            "/api/health/readiness",
            "/health/liveness",
            "/health/readiness",
        ];
    }
}
