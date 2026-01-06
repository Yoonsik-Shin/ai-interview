import { Body, Controller, Post } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';

@Controller('api/v1/interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  async createInterview(@Body() createInterviewDto: CreateInterviewDto) {
    // TODO: 원래는 인증 가드(AuthGuard)를 통해 JWT 토큰에서 userId를 뽑아야 합니다.
    // 지금은 테스트를 위해 1번 유저로 하드코딩합니다.
    // (DB에 user_id가 1인 유저와 resume_id가 1인 이력서가 있어야 합니다.)
    const mockUserId = 1;

    return await this.interviewsService.createInterview(
      mockUserId,
      createInterviewDto,
    );
  }
}
