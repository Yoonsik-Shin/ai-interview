.PHONY: proto clean run dev install help

# 의존성 설치 (uv)
install:
	@echo "📦 Installing dependencies with uv..."
	uv sync

# Proto 파일 컴파일
proto:
	@echo "🔨 Compiling proto files..."
	mkdir -p generated
	uv run python -m grpc_tools.protoc \
		-I../proto \
		--python_out=generated \
		--grpc_python_out=generated \
		../proto/stt.proto
	uv run python -c "import sys; content = open('generated/stt_pb2_grpc.py').read(); open('generated/stt_pb2_grpc.py', 'w').write(content.replace('import stt_pb2 as stt__pb2', 'from . import stt_pb2 as stt__pb2'))"
	touch generated/__init__.py
	@echo "✅ Proto compilation done!"

# 생성된 proto 파일 삭제
clean:
	@echo "🧹 Cleaning generated proto files..."
	rm -rf generated
	rm -f stt_pb2.py stt_pb2_grpc.py
	rm -rf __pycache__
	@echo "✅ Clean done!"

# STT 서비스 실행 (FastAPI + gRPC 통합)
run:
	@echo "🚀 Starting STT Service (FastAPI + gRPC)..."
	uv run python start.py

# 개발 모드 (run과 동일)
dev: run

# 도움말
help:
	@echo "STT Makefile Commands (uv based):"
	@echo "  make install  - Install dependencies using uv"
	@echo "  make proto    - Compile proto files"
	@echo "  make clean    - Remove generated proto files"
	@echo "  make run      - Run STT Service (start.py)"
	@echo "  make dev      - Run STT Service (alias for run)"
	@echo "  make help     - Show this help message"
