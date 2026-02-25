# DevTool - Stage Skipper 구현 문서

## 개요

개발 환경 전용 DevTool Stage Skipper는 면접 진행 중 특정 단계로 강제 이동할 수 있는 개발 도구입니다. 이를 통해 개발자는 특정 단계의 동작을 빠르게 테스트하고 디버깅할 수 있습니다.

## 아키텍처

```
Frontend (DevToolPanel)
    ↓ POST /v1/devtool/interviews/:id/force-stage
BFF (DevToolController + DevToolGuard)
    ↓ gRPC ForceStage
Core (InterviewGrpcController)
    ↓
ForceStageInteractor
    ↓
InterviewSession.forceChangeStage()
```

## 구현 상세

### 1. Proto 정의

**파일**: `services/proto/interview/v1/interview.proto`

```protobuf
service InterviewService {
  // ... 기존 RPC들
  rpc ForceStage(ForceStageRequest) returns (ForceStageResponse);
}

message ForceStageRequest {
  string interview_id = 1;
  InterviewStageProto target_stage = 2;
}

message ForceStageResponse {
  string interview_id = 1;
  InterviewStageProto current_stage = 2;
  string message = 3;
}
```

### 2. Core Service

#### 2.1 Domain Layer

**파일**: `InterviewSession.java`

```java
public void forceChangeStage(InterviewStage targetStage) {
    this.stage = targetStage;
}
```

- **목적**: 검증 없이 단계를 직접 변경 (개발 전용)
- **주의**: 프로덕션 환경에서는 절대 호출되지 않도록 Guard로 보호

#### 2.2 Application Layer

**파일**: `ForceStageInteractor.java`

```java
@Service
@RequiredArgsConstructor
public class ForceStageInteractor implements ForceStageUseCase {
    private final InterviewPort interviewPort;

    @Override
    @Transactional
    public ForceStageResult execute(ForceStageCommand command) {
        UUID interviewId = UUID.fromString(command.interviewId());
        InterviewSession session = interviewPort.loadById(interviewId)
                .orElseThrow(() -> new IllegalArgumentException("Interview not found"));

        InterviewStage targetStage = InterviewStage.valueOf(command.targetStage());
        session.forceChangeStage(targetStage);

        interviewPort.save(session);

        return new ForceStageResult(
                session.getId(),
                session.getCurrentStage(),
                "Stage forcefully changed to " + targetStage
        );
    }
}
```

**DTO**:

- `ForceStageCommand`: `interviewId`, `targetStage`
- `ForceStageResult`: `interviewId`, `currentStage`, `message`

#### 2.3 Adapter Layer

**파일**: `InterviewGrpcController.java`

```java
@Override
public void forceStage(
        ForceStageRequest request,
        StreamObserver<ForceStageResponse> responseObserver) {
    try {
        log.warn("[DevTool] Received forceStage request: interviewId={}, targetStage={}",
                request.getInterviewId(), request.getTargetStage());

        var command = new ForceStageCommand(
                request.getInterviewId(),
                request.getTargetStage().name()
        );

        var result = forceStageUseCase.execute(command);

        var response = ForceStageResponse.newBuilder()
                .setInterviewId(result.interviewId())
                .setCurrentStage(mapper.toProtoStage(result.currentStage()))
                .setMessage(result.message())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    } catch (Exception e) {
        log.error("[DevTool] Failed to force stage", e);
        io.grpc.Status status = GlobalGrpcExceptionHandler.toGrpcStatus(e);
        responseObserver.onError(status.asRuntimeException());
    }
}
```

**파일**: `InterviewGrpcMapper.java`

```java
public InterviewStageProto toProtoStage(InterviewStage stage) {
    return toProtoInterviewStage(stage);
}
```

### 3. BFF Service

#### 3.1 DevToolGuard

**파일**: `services/bff/src/guards/devtool.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

@Injectable()
export class DevToolGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== "development") {
      throw new ForbiddenException(
        "DevTool is only available in development environment",
      );
    }
    return true;
  }
}
```

- **목적**: 개발 환경에서만 DevTool API 접근 허용
- **동작**: `NODE_ENV !== 'development'`일 때 403 Forbidden 반환

#### 3.2 DevToolController

**파일**: `services/bff/src/modules/devtool/devtool.controller.ts`

```typescript
@Controller("v1/devtool")
@UseGuards(DevToolGuard)
export class DevToolController {
  constructor(private readonly forceStageUseCase: ForceStageUseCase) {}

  @Post("interviews/:id/force-stage")
  async forceStage(
    @Param("id") interviewId: string,
    @Body("targetStage") targetStage: string,
  ) {
    const command = new ForceStageCommand(interviewId, targetStage);
    return await this.forceStageUseCase.execute(command);
  }
}
```

#### 3.3 ForceStageUseCase

**파일**: `services/bff/src/modules/devtool/usecases/force-stage.usecase.ts`

```typescript
@Injectable()
export class ForceStageUseCase {
  constructor(private readonly interviewGrpcService: InterviewGrpcService) {}

  async execute(command: ForceStageCommand) {
    const { interviewId, targetStage } = command;

    await this.interviewGrpcService.forceStage(interviewId, targetStage);

    return {
      interviewId,
      stage: targetStage,
      message: `Stage forcefully changed to ${targetStage}`,
    };
  }
}
```

#### 3.4 InterviewGrpcService

**파일**: `services/bff/src/infra/grpc/services/interview-grpc.service.ts`

```typescript
async forceStage(interviewId: string, targetStage: string): Promise<any> {
    const service = this.interviewService as any;
    return firstValueFrom(service.forceStage({ interviewId, targetStage }));
}
```

#### 3.5 DevToolModule

**파일**: `services/bff/src/modules/devtool/devtool.module.ts`

```typescript
@Module({
  imports: [GrpcModule],
  controllers: [DevToolController],
  providers: [ForceStageUseCase, DevToolGuard],
})
export class DevToolModule {}
```

**등록**: `AppModule`의 imports에 추가

### 4. Frontend

#### 4.1 DevToolPanel 컴포넌트

**파일**: `frontend/src/components/DevTool/DevToolPanel.tsx`

```typescript
export const DevToolPanel: React.FC<DevToolPanelProps> = ({ interviewId }) => {
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleSkip = async () => {
    if (!selectedStage) {
      setMessage('Please select a stage');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await client.post<{ interviewId: string; stage: string; message: string }>(
        `/v1/devtool/interviews/${interviewId}/force-stage`,
        { targetStage: selectedStage }
      );

      setMessage(`✓ Stage changed to ${selectedStage}`);
      console.log('[DevTool] Stage changed:', response);
    } catch (error) {
      console.error('[DevTool] Failed to change stage:', error);
      setMessage('✗ Failed to change stage');
    } finally {
      setIsLoading(false);
    }
  };

  // 개발 환경에서만 렌더링
  if (import.meta.env.MODE !== 'development') {
    return null;
  }

  return (
    <div className="devtool-panel">
      {/* UI 구현 */}
    </div>
  );
};
```

**지원 단계**:

```typescript
const STAGES = [
  "WAITING",
  "GREETING",
  "CANDIDATE_GREETING",
  "INTERVIEWER_INTRO",
  "SELF_INTRO_PROMPT",
  "SELF_INTRO",
  "IN_PROGRESS",
  "LAST_QUESTION_PROMPT",
  "LAST_ANSWER",
  "CLOSING_GREETING",
  "COMPLETED",
];
```

#### 4.2 스타일

**파일**: `frontend/src/components/DevTool/DevToolPanel.css`

**주요 특징**:

- 고정 위치: `position: fixed; bottom: 20px; right: 20px;`
- 어두운 배경: `background: rgba(0, 0, 0, 0.9);`
- 주황색 테마: `border: 2px solid #ff6b35;`
- Glassmorphism: `backdrop-filter: blur(10px);`
- 높은 z-index: `z-index: 9999;`

#### 4.3 Interview.tsx 통합

**파일**: `frontend/src/pages/Interview.tsx`

```typescript
import { DevToolPanel } from "@/components/DevTool/DevToolPanel";

// ...

return (
  <div className={styles.interviewContainer}>
    {/* 기존 UI */}

    {/* DevTool Panel (개발 환경 전용) */}
    {interviewId && <DevToolPanel interviewId={interviewId} />}
  </div>
);
```

## 보안 고려사항

### 1. 이중 보호 (Defense in Depth)

**Backend Guard**:

```typescript
if (process.env.NODE_ENV !== "development") {
  throw new ForbiddenException(
    "DevTool is only available in development environment",
  );
}
```

**Frontend 조건부 렌더링**:

```typescript
if (import.meta.env.MODE !== "development") {
  return null;
}
```

### 2. 로깅

모든 DevTool 사용은 `[DevTool]` 접두사로 로깅되어 추적 가능:

```java
log.warn("[DevTool] Received forceStage request: interviewId={}, targetStage={}", ...);
log.warn("[DevTool] Stage forcefully changed: interviewId={}, newStage={}", ...);
```

## 사용 방법

### 개발 환경 설정

1. **Backend**: `NODE_ENV=development`로 실행
2. **Frontend**: Vite 개발 서버로 실행 (`pnpm run dev`)

### UI 사용

1. 면접 페이지 접속
2. 우측 하단에 DevTool Panel 표시 확인
3. 드롭다운에서 원하는 단계 선택
4. "Force Change Stage" 버튼 클릭
5. 성공/실패 메시지 확인

### API 직접 호출 (선택)

```bash
curl -X POST http://localhost:3000/v1/devtool/interviews/{interviewId}/force-stage \
  -H "Content-Type: application/json" \
  -d '{"targetStage": "IN_PROGRESS"}'
```

## 테스트 시나리오

### 1. 정상 동작 테스트

- [ ] 개발 환경에서 DevTool Panel 표시 확인
- [ ] 각 단계로 강제 이동 성공
- [ ] 성공 메시지 표시 확인
- [ ] 로그에 `[DevTool]` 기록 확인

### 2. 보안 테스트

- [ ] 프로덕션 환경에서 DevTool Panel 미표시 확인
- [ ] 프로덕션 환경에서 API 호출 시 403 Forbidden 확인
- [ ] 존재하지 않는 interviewId로 호출 시 에러 처리 확인

### 3. 에러 처리 테스트

- [ ] 잘못된 stage 값 입력 시 에러 메시지 표시
- [ ] 네트워크 에러 시 실패 메시지 표시
- [ ] 서버 에러 시 적절한 에러 처리

## 파일 목록

### Backend (Core)

- `services/core/src/main/java/me/unbrdn/core/interview/application/interactor/ForceStageInteractor.java`
- `services/core/src/main/java/me/unbrdn/core/interview/application/port/in/ForceStageCommand.java`
- `services/core/src/main/java/me/unbrdn/core/interview/application/port/in/ForceStageResult.java`
- `services/core/src/main/java/me/unbrdn/core/interview/application/port/in/ForceStageUseCase.java`
- `services/core/src/main/java/me/unbrdn/core/interview/domain/entity/InterviewSession.java` (수정)
- `services/core/src/main/java/me/unbrdn/core/interview/adapter/in/grpc/InterviewGrpcController.java` (수정)
- `services/core/src/main/java/me/unbrdn/core/interview/adapter/in/grpc/InterviewGrpcMapper.java` (수정)

### Backend (BFF)

- `services/bff/src/guards/devtool.guard.ts`
- `services/bff/src/modules/devtool/devtool.controller.ts`
- `services/bff/src/modules/devtool/devtool.module.ts`
- `services/bff/src/modules/devtool/usecases/force-stage.usecase.ts`
- `services/bff/src/modules/devtool/dto/force-stage.command.ts`
- `services/bff/src/infra/grpc/services/interview-grpc.service.ts` (수정)
- `services/bff/src/app.module.ts` (수정)

### Frontend

- `frontend/src/components/DevTool/DevToolPanel.tsx`
- `frontend/src/components/DevTool/DevToolPanel.css`
- `frontend/src/pages/Interview.tsx` (수정)

### Proto

- `services/proto/interview/v1/interview.proto` (수정)

## 주의사항

1. **절대 프로덕션 배포 금지**: DevToolGuard와 조건부 렌더링으로 보호되지만, 코드 자체가 프로덕션에 포함되지 않도록 주의
2. **로깅 모니터링**: `[DevTool]` 로그가 프로덕션 환경에 나타나면 즉시 조사
3. **단계 검증 없음**: `forceChangeStage`는 검증 없이 단계를 변경하므로 데이터 일관성 문제 발생 가능 (개발 전용)

## 향후 개선 사항

1. **단계 설명 추가**: 각 단계에 대한 설명 툴팁 표시
2. **현재 단계 표시**: 현재 면접 단계를 DevTool Panel에 표시
3. **단계 히스토리**: 강제 변경 히스토리 표시
4. **키보드 단축키**: 빠른 단계 이동을 위한 단축키 지원
5. **단계별 상태 미리보기**: 각 단계로 이동 시 예상 상태 미리보기

## 참고 문서

- [아키텍처 문서](./architecture.md)
- [코딩 컨벤션](./coding_convention.md)
- [의사결정 기록](./design-decisions.md)
