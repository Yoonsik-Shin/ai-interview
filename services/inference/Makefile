.PHONY: proto clean run help

# Proto 파일 컴파일
proto:
	@echo "🔨 Compiling proto files..."
	mkdir -p generated
	python -m grpc_tools.protoc \
		-I../proto \
		--python_out=generated \
		--grpc_python_out=generated \
		../proto/inference.proto
	python -c "import sys; content = open('generated/inference_pb2_grpc.py').read(); open('generated/inference_pb2_grpc.py', 'w').write(content.replace('import inference_pb2 as inference__pb2', 'from . import inference_pb2 as inference__pb2'))"
	touch generated/__init__.py
	@echo "✅ Proto compilation done!"

# 생성된 proto 파일 삭제
clean:
	@echo "🧹 Cleaning generated proto files..."
	rm -rf generated
	rm -f inference_pb2.py inference_pb2_grpc.py
	rm -rf __pycache__
	@echo "✅ Clean done!"

# 서버 실행
run: proto
	@echo "🚀 Starting Inference gRPC server..."
	python grpc_server.py

# 도움말
help:
	@echo "Inference Service Makefile Commands:"
	@echo "  make proto    - Compile proto files from ../proto/inference.proto"
	@echo "  make clean    - Remove generated proto files"
	@echo "  make run      - Compile proto and run gRPC server"
	@echo "  make help     - Show this help message"
