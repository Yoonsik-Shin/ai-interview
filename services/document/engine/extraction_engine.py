import fitz  # PyMuPDF
import io
import os
import uuid
from PIL import Image
import config
from utils.log_format import log_json
import requests
import grpc
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
        Extracts text and images from a PDF file.
        Returns a dictionary with 'text' and 'image_urls'.
        """
        log_json("extraction_started", resume_id=resume_id, object_key=object_key)
        
        # 1. Get Internal Download URL & Download File
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
            
            response = requests.get(download_url, stream=True)
            response.raise_for_status()
            file_bytes = io.BytesIO(response.content)
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as e:
            log_json("pdf_download_failed", error=str(e), key=object_key)
            raise Exception(f"Failed to download or open PDF: {str(e)}")

        full_text_concatenated = []
        pages_data = []

        # 2. Iterate Pages
        for page_num, page in enumerate(doc):
            # Extract Text for this page
            page_text = page.get_text()
            full_text_concatenated.append(page_text)
            
            page_images = []

            # Extract Images for this page
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    pil_image = Image.open(io.BytesIO(image_bytes))
                    width, height = pil_image.size
                    
                    if width >= config.MIN_IMAGE_WIDTH and height >= config.MIN_IMAGE_HEIGHT:
                        image_key = f"resumes/{resume_id}/images/{page_num}_{img_index}.{image_ext}"
                        
                        success, result = self._upload_file(image_key, image_bytes, f"image/{image_ext}")
                        
                        if success:
                            # Get public URL
                            public_url_req = storage_pb2.GetPresignedUrlRequest(
                                object_key=image_key,
                                method="get_object",
                                internal_access=False
                            )
                            pub_resp = self.storage_stub.GetPresignedUrl(public_url_req)
                            
                            img_data = {
                                "page": page_num,
                                "index": img_index,
                                "url": pub_resp.url,
                                "key": image_key,
                                "width": width,
                                "height": height
                            }
                            page_images.append(img_data)
                            log_json("image_extracted", resume_id=resume_id, key=image_key)
                        else:
                             log_json("image_upload_failed", resume_id=resume_id, key=image_key, error=result)

                    else:
                        log_json("image_ignored_small", resume_id=resume_id, width=width, height=height)
                except Exception as e:
                    log_json("image_extraction_failed", resume_id=resume_id, error=str(e), xref=xref)

            pages_data.append({
                "page_num": page_num + 1, # 1-indexed for human readability 
                "text": page_text,
                "images": page_images
            })

        doc.close()

        return {
            "text": "\n".join(full_text_concatenated), # Keep for global summary/validation
            "pages": pages_data,
            "all_images": [img for p in pages_data for img in p["images"]]
        }
