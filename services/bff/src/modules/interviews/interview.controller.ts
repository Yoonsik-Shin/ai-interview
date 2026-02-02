import {
    Body,
    Controller,
    Post,
    StreamableFile,
    Header,
    HttpException,
    HttpStatus,
    Inject,
    OnModuleInit,
    UseGuards,
    Request,
} from "@nestjs/common";
import { startInterviewUseCase } from "./usecases/interview.usecase";
import { CreateInterviewDto } from "./dto/create-interview.dto";
import type { ClientGrpc } from "@nestjs/microservices";
import { lastValueFrom, Observable } from "rxjs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

// gRPC LLM Service 인터페이스
interface TTSRequest {
    text: string;
    mode: string;
    persona: string;
    speed: number;
}

interface TTSChunk {
    audioData: Uint8Array;
    isFinal: boolean;
}

interface LlmServiceGrpc {
    textToSpeech(data: TTSRequest): Observable<TTSChunk>;
}

@Controller({ path: "interview", version: "1" })
export class InterviewController implements OnModuleInit {
    private llmGrpcService: LlmServiceGrpc;

    constructor(
        private readonly startInterviewUseCase: startInterviewUseCase,
        @Inject("LLM_PACKAGE") private readonly llmClient: ClientGrpc,
    ) {}

    onModuleInit() {
        this.llmGrpcService = this.llmClient.getService<LlmServiceGrpc>("LlmService");
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createInterview(@Request() req, @Body() createInterviewDto: CreateInterviewDto) {
        // JWT 토큰에서 인증된 사용자 ID 추출
        const userId = req.user.userId;

        return await this.startInterviewUseCase.execute(userId, createInterviewDto);
    }

    /**
     * TTS 프록시 엔드포인트 (gRPC)
     * LLM 서비스의 gRPC TTS를 BFF를 통해 프록시
     */
    @Post("tts")
    @Header("Content-Type", "audio/mpeg")
    async textToSpeech(
        @Body()
        body: {
            text: string;
            mode: "practice" | "real";
            persona?: "PRESSURE" | "COMFORTABLE" | "RANDOM";
            speed?: number;
        },
    ): Promise<StreamableFile> {
        try {
            console.log(`[BFF TTS gRPC] Calling LLM gRPC`, {
                textLength: body.text.length,
                mode: body.mode,
                persona: body.persona,
            });

            const request: TTSRequest = {
                text: body.text,
                mode: body.mode,
                persona: body.persona || "COMFORTABLE",
                speed: body.speed || 1.0,
            };

            // gRPC 스트림 수신
            const stream = this.llmGrpcService.textToSpeech(request);
            const audioChunks: Buffer[] = [];

            // 스트림의 모든 청크를 수집
            await lastValueFrom(
                new Observable((observer) => {
                    stream.subscribe({
                        next: (chunk: TTSChunk) => {
                            audioChunks.push(Buffer.from(chunk.audioData));
                        },
                        error: (err) => observer.error(err),
                        complete: () => {
                            observer.next(null);
                            observer.complete();
                        },
                    });
                }),
            );

            // 모든 청크를 결합
            const fullAudio = Buffer.concat(audioChunks);

            console.log(`[BFF TTS gRPC] Received complete audio (${fullAudio.length} bytes)`);

            // MP3 오디오 스트림으로 반환
            return new StreamableFile(fullAudio);
        } catch (error) {
            console.error("[BFF TTS gRPC] Error:", error.message);

            throw new HttpException("TTS 생성 실패", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
