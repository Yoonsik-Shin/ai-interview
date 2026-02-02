import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { CreateInterviewDto } from "../dto/create-interview.dto";
import { lastValueFrom } from "rxjs";
import type { ClientGrpc } from "@nestjs/microservices";
import { CreateInterviewRequest, InterviewServiceGrpcClient } from "@grpc-types/interview";

// Manual interfaces removed

// gRPC 서비스 인터페이스 정의 (proto 파일 내용과 매핑)
@Injectable()
export class startInterviewUseCase implements OnModuleInit {
    private grpcService: InterviewServiceGrpcClient;

    constructor(@Inject("INTERVIEW_PACKAGE") private readonly client: ClientGrpc) {}

    onModuleInit() {
        this.grpcService =
            this.client.getService<InterviewServiceGrpcClient>("InterviewServiceGrpc");
    }

    async execute(userId: string, dto: CreateInterviewDto) {
        console.log(`BFF: gRPC 요청 전송 시작 (userId: ${userId})`);

        const payload: CreateInterviewRequest = {
            userId,
            ...(dto.resumeId && { resumeId: dto.resumeId.toString() }), // resumeId는 string이어야 함 (proto 정의상)
            domain: dto.domain,
            type: dto.type as unknown as number, // Enum 매핑 필요할 수 있음
            persona: dto.persona as unknown as number,
            interviewerCount: dto.interviewerCount,
            targetDurationMinutes: dto.targetDurationMinutes,
            selfIntroduction: dto.selfIntroduction,
        };

        try {
            const response = await lastValueFrom(this.grpcService.createInterview(payload));
            console.log("BFF: gRPC 응답 수신:", JSON.stringify(response));

            return {
                interviewId: response.interviewId, // UUID는 string이므로 Number(uuid)는 NaN임! string으로 반환해야 함.
                status: response.status,
            };
        } catch (error) {
            console.error("BFF: gRPC 호출 중 에러 발생", error);
            throw error;
        }
    }
}
