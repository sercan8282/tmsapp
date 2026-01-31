"""
Service voor PDF handtekeningen.
"""
import base64
import io
import logging
from datetime import datetime
from typing import Tuple, Optional

from django.core.files.base import ContentFile
from PIL import Image

logger = logging.getLogger(__name__)


def decode_base64_image(base64_string: str) -> Optional[bytes]:
    """
    Decode een base64 afbeelding string naar bytes.
    Ondersteunt zowel met als zonder data URI prefix.
    """
    try:
        # Verwijder data URI prefix indien aanwezig
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        return base64.b64decode(base64_string)
    except Exception as e:
        logger.error(f"Fout bij decoderen base64 afbeelding: {e}")
        return None


def create_signature_image(signature_bytes: bytes, target_width: int = 200) -> Optional[bytes]:
    """
    Maak een PNG afbeelding van de handtekening met transparante achtergrond.
    """
    try:
        img = Image.open(io.BytesIO(signature_bytes))
        
        # Converteer naar RGBA voor transparantie
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Schaal proportioneel
        aspect_ratio = img.height / img.width
        new_height = int(target_width * aspect_ratio)
        img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
        
        # Sla op als PNG
        output = io.BytesIO()
        img.save(output, format='PNG', optimize=True)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Fout bij maken handtekening afbeelding: {e}")
        return None


def add_signature_to_pdf(
    pdf_bytes: bytes,
    signature_bytes: bytes,
    page_number: int,
    x_percent: float,
    y_percent: float,
    width_percent: float = 20
) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Voeg een handtekening toe aan een PDF bestand.
    
    Args:
        pdf_bytes: De originele PDF als bytes
        signature_bytes: De handtekening afbeelding als PNG bytes
        page_number: Paginanummer (1-indexed)
        x_percent: X positie in percentage van pagina breedte (0-100)
        y_percent: Y positie in percentage van pagina hoogte (0-100)
        width_percent: Breedte van handtekening in percentage van pagina breedte
    
    Returns:
        Tuple van (signed_pdf_bytes, error_message)
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.error("PyMuPDF (fitz) is niet geïnstalleerd")
        return None, "PDF bibliotheek niet beschikbaar"
    
    try:
        # Open de PDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Valideer paginanummer
        if page_number < 1 or page_number > len(doc):
            return None, f"Ongeldig paginanummer. Document heeft {len(doc)} pagina's."
        
        # Haal de pagina op (0-indexed)
        page = doc[page_number - 1]
        page_rect = page.rect
        page_width = page_rect.width
        page_height = page_rect.height
        
        # Bereken handtekening afmetingen
        sig_width = (width_percent / 100) * page_width
        
        # Laad handtekening afbeelding om aspect ratio te bepalen
        sig_img = Image.open(io.BytesIO(signature_bytes))
        aspect_ratio = sig_img.height / sig_img.width
        sig_height = sig_width * aspect_ratio
        
        # Bereken positie (y is vanaf boven in PDF)
        x = (x_percent / 100) * page_width
        y = (y_percent / 100) * page_height
        
        # Maak rechthoek voor handtekening
        sig_rect = fitz.Rect(x, y, x + sig_width, y + sig_height)
        
        # Voeg handtekening toe als afbeelding
        page.insert_image(sig_rect, stream=signature_bytes)
        
        # Voeg metadata toe
        metadata = doc.metadata
        metadata['modDate'] = datetime.now().strftime("D:%Y%m%d%H%M%S")
        metadata['producer'] = 'TMS Document Signing'
        doc.set_metadata(metadata)
        
        # Sla op naar bytes
        output = io.BytesIO()
        doc.save(output, garbage=4, deflate=True)
        doc.close()
        
        return output.getvalue(), None
        
    except Exception as e:
        logger.error(f"Fout bij toevoegen handtekening aan PDF: {e}")
        return None, f"Fout bij ondertekenen: {str(e)}"


def get_pdf_info(pdf_bytes: bytes) -> Optional[dict]:
    """
    Haal informatie op over een PDF bestand.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.error("PyMuPDF (fitz) is niet geïnstalleerd")
        return None
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        info = {
            'page_count': len(doc),
            'pages': []
        }
        
        for i, page in enumerate(doc):
            rect = page.rect
            info['pages'].append({
                'number': i + 1,
                'width': rect.width,
                'height': rect.height
            })
        
        doc.close()
        return info
        
    except Exception as e:
        logger.error(f"Fout bij lezen PDF info: {e}")
        return None


def pdf_page_to_image(pdf_bytes: bytes, page_number: int, dpi: int = 150) -> Optional[bytes]:
    """
    Converteer een PDF pagina naar een PNG afbeelding.
    
    Args:
        pdf_bytes: De PDF als bytes
        page_number: Paginanummer (1-indexed)
        dpi: Resolutie van de afbeelding
    
    Returns:
        PNG afbeelding als bytes of None bij fout
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.error("PyMuPDF (fitz) is niet geïnstalleerd")
        return None
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if page_number < 1 or page_number > len(doc):
            return None
        
        page = doc[page_number - 1]
        
        # Render pagina naar afbeelding
        zoom = dpi / 72  # 72 is standaard PDF DPI
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Converteer naar PNG bytes
        img_bytes = pix.tobytes("png")
        
        doc.close()
        return img_bytes
        
    except Exception as e:
        logger.error(f"Fout bij converteren PDF pagina naar afbeelding: {e}")
        return None
