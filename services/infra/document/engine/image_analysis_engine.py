import openai
import config
from utils.log_format import log_json

class ImageAnalysisEngine:
    def __init__(self):
        self.api_key = config.OPENAI_API_KEY
        self.client = None
        if self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            log_json("image_analysis_warning", message="OPENAI_API_KEY not found. Image analysis will be skipped or mocked.")

    def analyze_image(self, image_url):
        """
        Generates a description for the image using GPT-4o.
        """
        if not self.client:
            return "Image analysis unavailable (No API Key)."

        try:
            response = self.client.chat.completions.create(
                model=config.VLM_MODEL_NAME,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Describe this image in detail, focusing on professional content (charts, portfolio, screenshots). If it's just decorative, say 'Decorative'."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                },
                            },
                        ],
                    }
                ],
                max_tokens=300,
            )
            description = response.choices[0].message.content
            return description
        except Exception as e:
            log_json("image_analysis_failed", error=str(e), url=image_url)
            return "Failed to analyze image."
