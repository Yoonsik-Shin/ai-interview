import fitz  # PyMuPDF
import requests
import config
from typing import Dict, List, Any, Optional
from utils.log_format import log_json

class ExtractionEngine:
    def __init__(self):
        pass

    def extract_all(self, resume_id: str, download_url: str) -> Dict[str, Any]:
        """Extract text and images from a document using a Presigned URL"""
        log_json("document_extraction_started", resume_id=resume_id)
        
        # 1. Download file via URL
        try:
            response = requests.get(download_url, timeout=30)
            if response.status_code != 200:
                raise ValueError(f"Failed to download file from URL (status: {response.status_code})")
            data = response.content
        except Exception as e:
            log_json("document_download_failed", resume_id=resume_id, error=str(e))
            raise

        try:
            # 2. Open document with PyMuPDF
            doc = fitz.open(stream=data, filetype="pdf")
            
            full_text = ""
            image_urls = []

            # 3. Iterate through pages
            for page_index in range(len(doc)):
                page = doc[page_index]
                
                # Extract text
                full_text += page.get_text() + "\n"
                
                # Extract images
                image_list = page.get_images(full_res=True)
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    ext = base_image["ext"]
                    
                    # Upload image
                    image_key = f"extracted/{resume_id}/p{page_index}_i{img_index}.{ext}"
                    url = self._upload_via_storage_service(image_key, image_bytes, f"image/{ext}")
                    if url:
                        image_urls.append(url)

            log_json("document_extraction_completed", 
                     resume_id=resume_id, 
                     text_len=len(full_text), 
                     image_count=len(image_urls))
            
            return {
                "text": full_text,
                "image_urls": image_urls
            }
        except Exception as e:
            log_json("document_extraction_failed", resume_id=resume_id, error=str(e))
            raise

    def _upload_via_storage_service(self, object_key: str, data: bytes, content_type: str) -> Optional[str]:
        """Request a presigned URL from storage service and upload directly"""
        try:
            # 1. Request presigned URL for upload (PUT)
            resp = requests.post(
                f"{config.STORAGE_SERVICE_URL}/presigned-url",
                json={"object_key": object_key, "method": "put_object"},
                timeout=5
            )
            if resp.status_code != 200:
                log_json("storage_service_url_request_failed", status=resp.status_code)
                return None
            
            upload_url = resp.json().get("url")
            if not upload_url:
                return None

            # 2. Upload to the presigned URL
            upload_resp = requests.put(
                upload_url, 
                data=data, 
                headers={"Content-Type": content_type},
                timeout=30
            )
            if upload_resp.status_code != 200:
                log_json("direct_upload_failed", status=upload_resp.status_code)
                return None

            # Construct logical URL for access
            return f"http://minio.unbrdn.svc.cluster.local:9000/{config.OBJECT_STORAGE_BUCKET}/{object_key}"
        except Exception as e:
            log_json("upload_via_storage_failed", error=str(e))
            return None
