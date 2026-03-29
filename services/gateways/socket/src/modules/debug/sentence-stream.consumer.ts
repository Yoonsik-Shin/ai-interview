import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { RedisStreamClient } from "../../infra/redis/redis.clients.js";
import { DebugTraceGateway } from "./debug-trace.gateway";

@Injectable()
export class SentenceStreamConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SentenceStreamConsumer.name);
    private readonly streamKey = "interview:sentence:generate";
    private stopSignal = false;
    private loopRunning = false;

    constructor(
        private readonly redisClient: RedisStreamClient,
        private readonly debugTraceGateway: DebugTraceGateway,
    ) {}

    onModuleInit() {
        // 개발 환경에서만 실행
        if (process.env.NODE_ENV !== "development") {
            return;
        }

        this.startConsumer().catch((error: unknown) => {
            this.logger.error(`Sentence Stream Consumer start failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    onModuleDestroy() {
        this.stopSignal = true;
    }

    private async startConsumer(): Promise<void> {
        if (this.loopRunning) return;
        this.loopRunning = true;

        this.logger.log(`Starting Sentence Stream Consumer for debug trace: ${this.streamKey}`);

        // Start loop
        void this.runLoop().catch((error: unknown) => {
            this.logger.error(
                `Sentence Stream Consumer loop error: ${error instanceof Error ? error.message : String(error)}`,
            );
        });

        await Promise.resolve();
    }

    private async runLoop(): Promise<void> {
        let lastId = "$"; // 실시간 데이터만 수집

        while (!this.stopSignal) {
            try {
                // XREAD BLOCK 5000 STREAMS interview:sentence:generate $
                const result = await (this.redisClient as any).xread(
                    "BLOCK",
                    5000,
                    "STREAMS",
                    this.streamKey,
                    lastId,
                );

                if (!result) continue;

                for (const [, entries] of result as any[]) {
                    for (const entry of entries as any[]) {
                        const entryId = entry[0];
                        lastId = entryId;

                        const fields = entry[1] as string[];
                        const payload = this.parsePayload(fields);

                        if (payload && payload.interviewId) {
                            // 트레이스 발행
                            this.debugTraceGateway.broadcastTrace(
                                payload.interviewId as string,
                                "CORE (LLM Sentence)",
                                {
                                    sentenceIndex: payload.sentenceIndex,
                                    text: payload.text,
                                    isFinal: payload.isFinal,
                                    persona: payload.persona,
                                    traceId: payload.traceId,
                                },
                            );
                        }
                    }
                }
            } catch (error) {
                // Ignore timeout or common redis errors during dev
                if (!this.stopSignal) {
                    this.logger.error(
                        `Sentence Stream Read Error: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        }
    }

    private parsePayload(fields: string[]): any | null {
        if (!fields || fields.length === 0) return null;

        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i];
            const value = fields[i + 1];
            if (key !== undefined && value !== undefined) {
                data[String(key)] = String(value);
            }
        }

        if (!data.payload) return null;

        try {
            return JSON.parse(data.payload);
        } catch {
            return null;
        }
    }
}
