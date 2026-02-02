import { Controller, Get, Res, Version, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { join } from "path";
import { existsSync } from "node:fs";

@Controller()
export class AppController {
    @Get("/test-client")
    @Version(VERSION_NEUTRAL)
    getTestClient(@Res() res: Response): void {
        // 환경 변수 경로가 유효하면 우선 사용, 없으면 기본 경로로 폴백
        const configuredPath = process.env.TEST_CLIENT_PATH;
        const fallbackPath = join(process.cwd(), "test-client.html");
        const htmlPath =
            configuredPath && existsSync(configuredPath) ? configuredPath : fallbackPath;

        if (existsSync(htmlPath)) {
            res.sendFile(htmlPath);
            return;
        }

        res.status(404).send("test-client.html 파일을 찾을 수 없습니다.");
    }
}
