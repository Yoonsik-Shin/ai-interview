import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { lastValueFrom } from "rxjs";
import type { ClientGrpc } from "@nestjs/microservices";
import {
    InterviewServiceGrpcClient,
    ListInterviewsRequest,
    ListInterviewsResponse,
} from "../../../generated/interview";

@Injectable()
export class ListInterviewsUseCase implements OnModuleInit {
    private grpcService: InterviewServiceGrpcClient;

    constructor(@Inject("INTERVIEW_PACKAGE") private readonly client: ClientGrpc) {}

    onModuleInit() {
        this.grpcService =
            this.client.getService<InterviewServiceGrpcClient>("InterviewServiceGrpc");
    }

    async execute(userId: string): Promise<ListInterviewsResponse> {
        const payload: ListInterviewsRequest = { userId };
        try {
            console.log(`BFF: ListInterviews gRPC 요청 전송 (userId: ${userId})`);
            const response = await lastValueFrom(this.grpcService.listInterviews(payload));
            console.log(
                "BFF: ListInterviews gRPC 응답 수신:",
                response.interviews?.length || 0,
                "건",
            );
            return response;
        } catch (error) {
            console.error("BFF: ListInterviews gRPC 호출 중 에러 발생", error);
            throw error;
        }
    }
}
