import { Injectable } from "@nestjs/common";
import { InterviewStage } from "../../../infra/grpc/services/interview-grpc.service";
import { AudioProcessor } from "./audio-processor.interface";
import { ProcessCandidateGreetingUseCase } from "./process-candidate-greeting.usecase";
import { ProcessSelfIntroUseCase } from "./process-self-intro.usecase";
import { ProcessNormalQAUseCase } from "./process-normal-qa.usecase";
import { ProcessLastAnswerUseCase } from "./process-last-answer.usecase";
import { ProcessClosingGreetingUseCase } from "./process-closing-greeting.usecase";

@Injectable()
export class AudioProcessorFactory {
    private readonly processors: Map<InterviewStage, AudioProcessor>;

    constructor(
        candidateGreeting: ProcessCandidateGreetingUseCase,
        selfIntro: ProcessSelfIntroUseCase,
        normalQA: ProcessNormalQAUseCase,
        lastAnswer: ProcessLastAnswerUseCase,
        closingGreeting: ProcessClosingGreetingUseCase,
    ) {
        this.processors = new Map<InterviewStage, AudioProcessor>([
            [InterviewStage.CANDIDATE_GREETING, candidateGreeting],
            [InterviewStage.SELF_INTRO, selfIntro],
            [InterviewStage.IN_PROGRESS, normalQA],
            [InterviewStage.LAST_ANSWER, lastAnswer],
            [InterviewStage.CLOSING_GREETING, closingGreeting],
        ]);
    }

    /** 현재 스테이지에 해당하는 프로세서 반환 */
    getProcessor(stage: InterviewStage): AudioProcessor | undefined {
        return this.processors.get(stage);
    }
}
