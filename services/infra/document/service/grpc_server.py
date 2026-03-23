import grpc
from concurrent import futures
import numpy as np
from document.v1 import document_pb2, document_pb2_grpc
from engine.embedding_engine import EmbeddingEngine
from utils.log_format import log_json


class DocumentServicer(document_pb2_grpc.DocumentServiceServicer):
    """gRPC servicer for Document service"""
    
    def __init__(self):
        self.embedding_engine = EmbeddingEngine()
        log_json("document_grpc_servicer_initialized")
    
    def GenerateEmbedding(self, request, context):
        """Generate embedding vector from text"""
        try:
            text = request.text
            
            if not text or len(text.strip()) == 0:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details("Text cannot be empty")
                return document_pb2.GenerateEmbeddingResponse()
            
            log_json("generate_embedding_request", text_length=len(text))
            
            # Generate embedding using existing engine
            embedding_vector = self.embedding_engine.encode(text)
            
            # Convert numpy array to list if needed
            if isinstance(embedding_vector, np.ndarray):
                embedding_list = embedding_vector.tolist()
            else:
                embedding_list = list(embedding_vector)
            
            dimension = len(embedding_list)
            
            log_json("generate_embedding_success", dimension=dimension)
            
            return document_pb2.GenerateEmbeddingResponse(
                embedding=embedding_list,
                dimension=dimension
            )
            
        except Exception as e:
            log_json("generate_embedding_error", error=str(e))
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Failed to generate embedding: {str(e)}")
            return document_pb2.GenerateEmbeddingResponse()


def serve_grpc(port=50053):
    """Start gRPC server"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    document_pb2_grpc.add_DocumentServiceServicer_to_server(
        DocumentServicer(), server
    )
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    log_json("document_grpc_server_started", port=port)
    return server
