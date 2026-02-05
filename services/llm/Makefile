.PHONY: proto clean run dev help

# Proto 파일 컴파일
proto:
	@echo "🔨 Compiling proto files..."
	mkdir -p generated
	python -m grpc_tools.protoc \
		-I../proto \
		--python_out=generated \
		--grpc_python_out=generated \
		../proto/llm.proto
	python -c "import sys; content = open('generated/llm_pb2_grpc.py').read(); open('generated/llm_pb2_grpc.py', 'w').write(content.replace('import llm_pb2 as llm__pb2', 'from . import llm_pb2 as llm__pb2'))"
	touch generated/__init__.py
	@echo "✅ Proto compilation done!"

# 생성된 proto 파일 삭제
clean:
	@echo "🧹 Cleaning generated proto files..."
	rm -rf generated
	rm -f llm_pb2.py llm_pb2_grpc.py
	rm -rf __pycache__
	@echo "✅ Clean done!"

# Proto 컴파일 후 서버 실행
run: proto
	@echo "🚀 Starting LLM gRPC server..."
	python grpc_server.py

# 개발 모드 (supervisord로 FastAPI + gRPC + Kafka 동시 실행)
dev: proto
	@echo "🚀 Starting all services with Supervisor..."
	supervisord -c supervisord.conf

# 도움말
help:
	@echo "LLM Service Makefile Commands:"
	@echo "  make proto    - Compile proto files from ../proto/llm.proto"
	@echo "  make clean    - Remove generated proto files"
	@echo "  make run      - Compile proto and run gRPC server"
	@echo "  make dev      - Compile proto and start all services (FastAPI + gRPC + Kafka)"
	@echo "  make help     - Show this help message"
