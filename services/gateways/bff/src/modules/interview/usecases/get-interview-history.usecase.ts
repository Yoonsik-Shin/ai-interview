import { Injectable } from "@nestjs/common";
import { InterviewGrpcService } from "../../../infra/grpc/services/interview-grpc.service";

export class GetInterviewHistoryCommand {
    constructor(public readonly interviewId: string) {}
}

@Injectable()
export class GetInterviewHistoryUseCase {
    constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

    async execute(command: GetInterviewHistoryCommand) {
        const response = await this.interviewGrpcService.getHistory(command.interviewId);

        return response.messages.map((m: any) => ({
            role: m.role,
            type: m.type,
            content: m.content,
            timestamp: m.timestamp,
            payload: m.payload,
        }));
    }
}
