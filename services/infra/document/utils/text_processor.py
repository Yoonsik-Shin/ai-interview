import re
import unicodedata

def normalize_text(text: str) -> str:
    """
    NFC normalization and whitespace cleanup for Korean/English text.
    Matches the logic in frontend's ResumeValidator.ts.
    """
    # 1. NFC Normalization (Fix NFD issue from Mac)
    text = unicodedata.normalize('NFC', text)
    # Remove NULL bytes for PostgreSQL UTF-8 compatibility
    text = text.replace('\x00', '')
    
    # 2. Cleanup whitespace
    # Remove all whitespace between Korean characters (e.g., '가 나 다' -> '가나다')
    text = re.sub(r'(?<=[가-힣])\s+(?=[가-힣])', '', text)
    # Keep single space between Korean and English/Numbers
    text = re.sub(r'([가-힣])\s+([a-zA-Z0-9])', r'\1 \2', text)
    text = re.sub(r'([a-zA-Z0-9])\s+([가-힣])', r'\1 \2', text)
    
    # 3. Collapse multiple whitespaces (including newlines) into single space
    text = re.sub(r'\s+', ' ', text)

    return text.strip()

def mask_pii(text: str) -> str:
    """
    Mask phone numbers, emails, and SSNs.
    Matches the logic in frontend's ResumeValidator.ts.
    """
    # Phone: 010-1234-5678, 010.1234.5678, 010 1234 5678, 01012345678 etc
    text = re.sub(r'(\d{2,3})[-.\s]?(\d{3,4})[-.\s]?(\d{4})', r'[PHONE]', text)
    # Email
    text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    # SSN: 000000-0000000
    text = re.sub(r'[0-9]{6}-[0-9]{7}', '[SSN]', text)
    
    return text

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50, metadata: dict = None) -> list:
    """
    Splits text into smaller chunks for RAG.
    Each chunk is a dictionary with 'content' and 'metadata'.
    """
    if not text:
        return []
        
    chunks = []
    start = 0
    text_len = len(text)
    base_metadata = metadata if metadata else {}
    
    while start < text_len:
        end = start + chunk_size
        chunk_content = text[start:end]
        
        # Create chunk with merged metadata
        chunk_data = {
            "content": chunk_content,
            "metadata": base_metadata.copy()
        }
        chunks.append(chunk_data)
        
        # Move start point back by overlap for the next chunk
        if text_len > chunk_size:
            start += (chunk_size - overlap)
        else:
            break
        
        # Avoid infinite loop if chunk_size <= overlap
        if chunk_size <= overlap:
            break
            
    return chunks
