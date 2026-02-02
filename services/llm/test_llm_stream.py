import grpc
import llm_pb2
import llm_pb2_grpc

def run():
    # LLM gRPC 서버 주소 (기본 50051 포트)
    channel = grpc.insecure_channel('localhost:50051')
    stub = llm_pb2_grpc.LlmServiceStub(channel)

    # 요청 생성
    request = llm_pb2.GenerateRequest(
        interview_id="test-session-123",
        user_id="user-1",
        user_text="자바 스트리밍에 대해 설명해주세요.",
        persona="COMFORTABLE",
        history=[]
    )

    print("--- LLM gRPC Stream Test Start ---")
    try:
        # 스트리밍 호출
        # Metadata에 session-id 포함 (Core 시뮬레이션)
        metadata = [('session-id', 'test-session-123')]
        responses = stub.GenerateResponse(request, metadata=metadata)

        for response in responses:
            if response.thinking:
                print(f"[Thinking] {response.thinking}")
            if response.token:
                print(f"[Token] {response.token}", end="", flush=True)
            if response.is_sentence_end:
                print("\n[Sentence End]")
            if response.is_final:
                print("\n[Final Response Received]")
    except Exception as e:
        print(f"\n[Error] {e}")
    print("\n--- LLM gRPC Stream Test End ---")

if __name__ == '__main__':
    run()
