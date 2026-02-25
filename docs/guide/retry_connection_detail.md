2. ⚠️ 구현 시 챙겨야 할 디테일 (Check Points)
   다이어그램을 실제 코드로 옮길 때 놓치기 쉬운 부분들을 짚어드립니다.

A. Kafka 파티션 키 (Partition Key) 설정 필수
상황: Pub A와 Pub B에서 메시지를 발행할 때입니다.

주의: 반드시 **sessionId를 파티션 키(Key)**로 지정해야 합니다.

이유: 키를 지정하지 않으면 라운드 로빈으로 분산되어, 사용자의 말 순서(문맥)가 뒤죽박죽 섞여 Core나 TTS에 도착할 수 있습니다. (예: "안녕" -> "하세요" 순서가 바뀜)

B. Core의 역할: 문맥 병합 (Context Merging)
상황: Pub A (STT 이벤트)를 Core가 받을 때입니다.

로직: STT는 문장 조각(Chunk)이나 짧은 문장을 보낼 수 있습니다. Core는 이것들을 받아서 **"지금 LLM을 호출할 타이밍인가?"**를 판단하는 로직(VAD 끝, 혹은 문장 완결성 체크)이 명확해야 합니다. 무조건 LLM을 호출하면 비용이 폭발합니다.

C. Redis 채널명 규칙 (Naming Convention)
다이어그램에 sub, pub이 잘 표현되어 있습니다. 실제 구현 시 채널명을 명확히 구조화하세요.

사용자 자막용: session:{id}:stt:text

AI 오디오용: session:{id}:ai:audio

AI 텍스트용: session:{id}:ai:text

이렇게 나눠두면 프론트엔드에서 필요한 것만 구독하기 편합니다.

D. gRPC 연결 관리 (Connection Keep-Alive)
Socket ↔ STT 및 Core ↔ LLM 구간은 롱 런(Long-running) 스트리밍입니다.

네트워크 문제로 끊어졌을 때 자동 재연결(Retry/Reconnect) 로직이 클라이언트(Socket, Core) 쪽에 반드시 있어야 서비스가 중단되지 않습니다.

gRPC 스트리밍은 일반적인 HTTP API 호출(Request/Response)과 달리 **"긴 파이프라인이 계속 연결되어 있는 상태"**를 유지해야 합니다. 특히 면접 도중 침묵(Silence)이 길어지거나 네트워크가 잠깐 흔들릴 때 연결이 끊어지면, 면접관이 "먹통"이 되는 치명적인 경험을 주게 됩니다.

이를 방지하기 위한 **[1. Keep-Alive 설정 (연결 유지)]**과 **[2. 재연결 로직 (복구)]**을 구체적으로 설명해 드리겠습니다.

1. Keep-Alive 설정 (중간에 끊김 방지)
   로드밸런서(LB), 방화벽, 혹은 K8s Ingress는 일정 시간 동안 데이터가 오고 가지 않으면 "이 연결은 죽었나 보다" 하고 연결을 끊어버립니다(Idle Timeout). 이를 막기 위해 "나 살아있어!" 라는 신호(Ping)를 주기적으로 보내야 합니다.

A. Node.js (Socket Server) → STT Client 설정
@grpc/grpc-js 라이브러리를 사용할 때, 클라이언트 생성 옵션에 다음을 추가해야 합니다.

JavaScript

const services = require('./protos/stt_grpc_pb');
const grpc = require('@grpc/grpc-js');

const client = new services.STTClient(
'stt:50052',
grpc.credentials.createInsecure(),
{
// [중요] Keep-Alive 설정
'grpc.keepalive_time_ms': 10000, // 10초마다 핑 보내기
'grpc.keepalive_timeout_ms': 5000, // 핑 보내고 5초 안에 응답 없으면 끊김 처리
'grpc.keepalive_permit_without_calls': 1, // 데이터 전송 없어도 핑 보내기 허용 (침묵 시 필수)
'grpc.http2.max_pings_without_data': 0 // 핑 횟수 제한 해제
}
);
B. Spring Boot (Core) → LLM Client 설정
Spring Boot(net.devh:grpc-client-spring-boot-starter)를 쓴다면 application.yml에서 설정 가능합니다.

YAML

grpc:
client:
llm-server:
address: 'static://llm-service:50051'
enable-keep-alive: true
keep-alive-time: 10s
keep-alive-timeout: 5s
keep-alive-without-calls: true # 데이터 없어도 핑 전송 (필수)
C. Python (AI Workers) Server 설정
서버(STT/LLM) 쪽에서도 클라이언트의 핑을 받아주도록 설정을 열어둬야 합니다.

Python

server = grpc.server(
futures.ThreadPoolExecutor(max_workers=10),
options=[
('grpc.keepalive_time_ms', 10000),
('grpc.keepalive_timeout_ms', 5000),
('grpc.keepalive_permit_without_calls', True),
('grpc.http2.max_pings_without_data', 0),
('grpc.http2.min_time_between_pings_ms', 10000),
('grpc.http2.min_ping_interval_without_data_ms', 5000),
]
) 2. 재연결 (Retry) 로직 (끊겼을 때 복구)
Keep-Alive를 해도 배포(Rolling Update)나 일시적 네트워크 장애로 연결은 끊길 수 있습니다. 이때 사용자가 눈치채지 못하게 재빨리 다시 연결해야 합니다.

A. Node.js (Socket Server) 구현 예시
스트림이 end 되거나 error가 발생했을 때 재귀적으로 다시 연결을 시도하는 패턴입니다.

JavaScript

class STTService {
constructor() {
this.call = null;
this.isConnected = false;
}

startStream(sessionId) {
// 1. 스트림 생성
this.call = client.transcribeStream();

    // 2. 데이터 수신 처리
    this.call.on('data', (response) => {
      // 정상 처리 로직
    });

    // 3. 에러 발생 시 (재연결 핵심)
    this.call.on('error', (err) => {
      console.error(`[Session ${sessionId}] STT Stream Error:`, err);
      this.isConnected = false;

      // 즉시 재연결 시도 또는 약간의 딜레이 후 시도
      setTimeout(() => {
        console.log(`[Session ${sessionId}] Reconnecting STT Stream...`);
        this.startStream(sessionId);
      }, 1000); // 1초 뒤 재연결 (Backoff 전략 권장)
    });

    // 4. 서버가 끊었을 때
    this.call.on('end', () => {
      if (!this.isConnected) { // 의도치 않게 끊긴 경우
         this.startStream(sessionId);
      }
    });

}
}
B. Spring Boot (Core) 구현 예시
Core가 LLM에게 요청을 보냈는데 실패했다면, Resilience4j 같은 라이브러리를 써서 재시도(Retry)하는 것이 가장 깔끔합니다.

Java

// Service Layer

@Retry(name = "llmRetry", fallbackMethod = "fallbackLLM")
public void requestLLMAnswer(String prompt) {
// gRPC 스트리밍 호출
StreamObserver<Answer> responseObserver = ...;
stub.generateAnswer(request, responseObserver);
}

// 재시도 설정 (application.yml)
resilience4j:
retry:
instances:
llmRetry:
max-attempts: 3 # 최대 3번 재시도
wait-duration: 500ms # 0.5초 대기 후 재시도
retry-exceptions: - io.grpc.StatusRuntimeException # gRPC 에러 발생 시만 3. 핵심 요약 및 팁
OCI Load Balancer 주의: 오라클 클라우드 로드밸런서의 기본 Idle Timeout 설정을 확인하세요. gRPC keepalive_time은 반드시 로드밸런서의 타임아웃 시간보다 짧아야 합니다. (예: LB 타임아웃이 60초면, Keep-Alive는 30초로 설정)

Idempotency (멱등성): 재연결되었을 때, 이전 대화 맥락이 끊기지 않도록 sessionId를 메타데이터(Header)에 꼭 실어 보내세요.

지수 백오프 (Exponential Backoff): 재연결 시도 시 1초, 2초, 4초, 8초... 처럼 대기 시간을 늘려가며 시도하세요. 서버가 죽어서 켜지는 중일 때 무한 요청을 보내면 서버가 뜨자마자 다시 죽을 수 있습니다.
