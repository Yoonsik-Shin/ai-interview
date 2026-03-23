import io
import os
import uuid
import json
import shutil
import requests
import grpc
from PIL import Image
import config
from utils.log_format import log_json
from storage.v1 import storage_pb2, storage_pb2_grpc

class ExtractionEngine:
    def __init__(self):
        # Initialize gRPC Channel to Storage Service
        storage_url = config.STORAGE_SERVICE_URL.replace("http://", "").replace("https://", "")
        self.channel = grpc.insecure_channel(storage_url)
        self.storage_stub = storage_pb2_grpc.StorageServiceStub(self.channel)
        
    def _upload_file(self, object_key, data_bytes, content_type):
        """Upload file via Storage Service (Presigned URL)"""
        try:
            # 1. Get Presigned URL (Internal Access)
            request = storage_pb2.GetPresignedUrlRequest(
                object_key=object_key,
                method="put_object",
                expiration_sec=3600,
                internal_access=True
            )
            response = self.storage_stub.GetPresignedUrl(request)
            
            if not response.url:
                raise Exception("Failed to get presigned URL")
                
            upload_url = response.url
            
            # 2. Upload content
            headers = {"Content-Type": content_type}
            resp = requests.put(upload_url, data=data_bytes, headers=headers)
            resp.raise_for_status()
            
            return True, upload_url
            
        except grpc.RpcError as e:
            log_json("grpc_upload_error", object_key=object_key, code=e.code(), details=e.details())
            return False, str(e)
        except Exception as e:
            log_json("upload_error", object_key=object_key, error=str(e))
            return False, str(e)

    def extract_all(self, resume_id, object_key):
        """
        Extracts text and images from a PDF file using opendataloader-pdf.
        Returns a dictionary with 'text', 'pages', and 'all_images'.
        """
        import opendataloader_pdf

        log_json("extraction_started", resume_id=resume_id, object_key=object_key)
        
        # 1. Get Internal Download URL & Download File
        temp_pdf_path = f"/tmp/{resume_id}.pdf"
        output_folder = f"/tmp/{resume_id}_out"
        os.makedirs(output_folder, exist_ok=True)

        try:
            # Get Presigned URL for Download (Internal)
            request = storage_pb2.GetPresignedUrlRequest(
                object_key=object_key,
                method="get_object",
                expiration_sec=300,
                internal_access=True
            )
            response = self.storage_stub.GetPresignedUrl(request)
            if not response.url:
                 raise Exception("Failed to get download URL from Storage Service")
            
            download_url = response.url
            
            # Download file
            response = requests.get(download_url, stream=True)
            response.raise_for_status()
            with open(temp_pdf_path, "wb") as f:
                f.write(response.content)
            log_json("pdf_downloaded", path=temp_pdf_path)
            
        except Exception as e:
            log_json("pdf_download_failed", error=str(e), key=object_key)
            if os.path.exists(temp_pdf_path): os.remove(temp_pdf_path)
            raise Exception(f"Failed to download or open PDF: {str(e)}")

        try:
            # 2. Run opendataloader-pdf
            log_json("opendataloader_start", resume_id=resume_id)
            opendataloader_pdf.convert(
                input_path=temp_pdf_path,
                output_dir=output_folder,
                format=['markdown', 'json'],
                image_output="external"
            )
            log_json("opendataloader_completed", resume_id=resume_id)

            # 3. Read Extracted Data
            full_text = ""
            json_files = [f for f in os.listdir(output_folder) if f.endswith(".json")]
            md_files = [f for f in os.listdir(output_folder) if f.endswith(".md") or f.endswith(".markdown")]

            if md_files:
                md_path = os.path.join(output_folder, md_files[0])
                with open(md_path, "r", encoding="utf-8") as f:
                    full_text = f.read()

            if not full_text.strip() and json_files:
                json_path = os.path.join(output_folder, json_files[0])
                with open(json_path, "r", encoding="utf-8") as f:
                    parsed = json.load(f)
                    if isinstance(parsed, dict):
                        full_text = parsed.get("content", parsed.get("text", str(parsed)))

            # 4. Handle Images
            page_images = []
            extracted_images = []
            for f in os.listdir(output_folder):
                if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                    extracted_images.append(os.path.join(output_folder, f))

            log_json("images_detected", count=len(extracted_images))

            for img_index, img_path in enumerate(extracted_images):
                try:
                    with open(img_path, "rb") as f:
                        image_bytes = f.read()
                    pil_image = Image.open(io.BytesIO(image_bytes))
                    width, height = pil_image.size
                    image_ext = img_path.split('.')[-1]

                    if width >= config.MIN_IMAGE_WIDTH and height >= config.MIN_IMAGE_HEIGHT:
                        image_key = f"resumes/{resume_id}/images/idx_{img_index}.{image_ext}"
                        success, result = self._upload_file(image_key, image_bytes, f"image/{image_ext}")
                        
                        if success:
                            pub_req = storage_pb2.GetPresignedUrlRequest(object_key=image_key, method="get_object", internal_access=False)
                            pub_resp = self.storage_stub.GetPresignedUrl(pub_req)
                            page_images.append({
                                "page": 0, "index": img_index, "url": pub_resp.url, "key": image_key, "width": width, "height": height
                            })
                except Exception as e:
                    log_json("image_upload_failed", error=str(e), path=img_path)

            # 5. Build output model matching previous shape
            pages_data = [{
                "page_num": 1,
                "text": full_text,
                "images": page_images
            }]

            return {
                "text": full_text,
                "pages": pages_data,
                "all_images": page_images
            }

        finally:
            try:
                if os.path.exists(temp_pdf_path): os.remove(temp_pdf_path)
                if os.path.exists(output_folder): shutil.rmtree(output_folder)
            except: pass
