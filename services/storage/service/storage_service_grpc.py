import grpc
from concurrent import futures
from generated import storage_pb2, storage_pb2_grpc
from utils.log_format import log_json
from config import PORT # gRPC 포트도 기존 PORT 환경변수 사용

class StorageServiceServicer(storage_pb2_grpc.StorageServiceServicer):
    def __init__(self, storage_engine):
        self.storage_engine = storage_engine

    def GetPresignedUrl(self, request, context):
        """Generate a presigned URL for upload or download"""
        if not self.storage_engine:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Storage engine not initialized")
            return storage_pb2.GetPresignedUrlResponse()
        
        log_json("grpc_get_presigned_url_request", internal_access=request.internal_access, key=request.object_key)
        
        url = self.storage_engine.generate_presigned_url(
            request.object_key, 
            method=request.method,
            expiration=request.expiration_sec or 3600,
            internal_access=request.internal_access
        )
        
        if url:
            return storage_pb2.GetPresignedUrlResponse(url=url)
        
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details("Failed to generate URL")
        return storage_pb2.GetPresignedUrlResponse()

    def DeleteObject(self, request, context):
        """Delete an object from storage"""
        if not self.storage_engine:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Storage engine not initialized")
            return storage_pb2.DeleteObjectResponse(success=False, message="Engine not initialized")
        
        try:
            self.storage_engine.client.delete_object(
                Bucket=self.storage_engine.bucket,
                Key=request.object_key
            )
            log_json("file_deleted_via_grpc", object_key=request.object_key)
            return storage_pb2.DeleteObjectResponse(success=True, message="Deleted")
        except Exception as e:
            log_json("file_delete_failed_grpc", object_key=request.object_key, error=str(e))
            return storage_pb2.DeleteObjectResponse(success=False, message=str(e))

def serve_grpc(storage_engine):
    """Start gRPC server"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    storage_pb2_grpc.add_StorageServiceServicer_to_server(
        StorageServiceServicer(storage_engine), server
    )
    
    # gRPC Health Check 서비스 추가
    from grpc_health.v1 import health
    from grpc_health.v1 import health_pb2
    from grpc_health.v1 import health_pb2_grpc
    
    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    
    # 상태를 SERVING으로 설정
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    
    # Secure Port 또는 Insecure Port 설정 (내부 통신이므로 Insecure 사용)
    server.add_insecure_port(f"[::]:{PORT}")
    
    log_json("storage_grpc_server_start", port=PORT)
    server.start()
    server.wait_for_termination()
