import { RegisterRecruiterResult } from "../../usecases/register-recruiter.usecase";
import { RegisterCandidateResult } from "../../usecases/register-candidate.usecase";

export class RegisterResponseDto {
    userId: string;

    constructor(result: RegisterCandidateResult | RegisterRecruiterResult) {
        this.userId = result.userId;
    }
}
