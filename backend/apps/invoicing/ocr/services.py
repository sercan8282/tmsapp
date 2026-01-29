"""
Invoice OCR Service - Self-learning text extraction from invoices
"""
import re
import os
import json
import logging
from typing import Optional, Dict, List, Any, Tuple
from decimal import Decimal
from datetime import datetime
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile


logger = logging.getLogger(__name__)


@dataclass
class BoundingBox:
    """Represents a region on a page."""
    x: float
    y: float
    width: float
    height: float
    page: int = 0
    
    def to_dict(self) -> Dict:
        return {
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height,
            'page': self.page
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'BoundingBox':
        return cls(
            x=data.get('x', 0),
            y=data.get('y', 0),
            width=data.get('width', 0),
            height=data.get('height', 0),
            page=data.get('page', 0)
        )


@dataclass
class OCRWord:
    """Represents a single word extracted by OCR."""
    text: str
    confidence: float
    bbox: BoundingBox
    
    def to_dict(self) -> Dict:
        return {
            'text': self.text,
            'confidence': self.confidence,
            'bbox': self.bbox.to_dict()
        }


@dataclass
class OCRLine:
    """Represents a line of text extracted by OCR."""
    text: str
    confidence: float
    bbox: BoundingBox
    words: List[OCRWord] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            'text': self.text,
            'confidence': self.confidence,
            'bbox': self.bbox.to_dict(),
            'words': [w.to_dict() for w in self.words]
        }


@dataclass
class OCRPage:
    """Represents a page with OCR results."""
    page_number: int
    width: float
    height: float
    text: str
    confidence: float
    lines: List[OCRLine] = field(default_factory=list)
    image_path: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'page_number': self.page_number,
            'width': self.width,
            'height': self.height,
            'text': self.text,
            'confidence': self.confidence,
            'lines': [l.to_dict() for l in self.lines],
            'image_path': self.image_path
        }


@dataclass
class OCRResult:
    """Complete OCR result for a document."""
    pages: List[OCRPage] = field(default_factory=list)
    full_text: str = ""
    avg_confidence: float = 0.0
    
    def to_dict(self) -> Dict:
        return {
            'pages': [p.to_dict() for p in self.pages],
            'full_text': self.full_text,
            'avg_confidence': self.avg_confidence
        }


class OCREngine:
    """
    OCR Engine using Tesseract for text extraction.
    """
    
    def __init__(self):
        self.tesseract_available = False
        self.pdf2image_available = False
        self._check_dependencies()
    
    def _check_dependencies(self):
        """Check if required dependencies are available."""
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self.tesseract_available = True
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
        
        try:
            import pdf2image
            self.pdf2image_available = True
        except ImportError:
            logger.warning("pdf2image not available")
    
    def process_file(self, file_path: str, language: str = 'nld+eng') -> OCRResult:
        """
        Process a file (PDF or image) and extract text with positions.
        
        Args:
            file_path: Path to the file
            language: Tesseract language codes
            
        Returns:
            OCRResult with all extracted data
        """
        if not self.tesseract_available:
            raise RuntimeError("Tesseract OCR is not installed or not available")
        
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext == '.pdf':
            return self._process_pdf(file_path, language)
        elif file_ext in ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif']:
            return self._process_image(file_path, language)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")
    
    def _process_pdf(self, file_path: str, language: str) -> OCRResult:
        """Process a PDF file."""
        if not self.pdf2image_available:
            raise RuntimeError("pdf2image is not installed")
        
        from pdf2image import convert_from_path
        import pytesseract
        from PIL import Image
        
        # Convert PDF to images
        images = convert_from_path(
            file_path,
            dpi=300,
            fmt='png'
        )
        
        pages = []
        all_text = []
        total_confidence = 0.0
        
        # Create temp directory for images
        temp_dir = Path(settings.MEDIA_ROOT) / 'temp' / 'ocr'
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        for i, image in enumerate(images):
            # Save image temporarily
            img_path = temp_dir / f"page_{i}.png"
            image.save(str(img_path))
            
            # Process page
            page = self._process_single_image(
                image, 
                i, 
                language,
                str(img_path)
            )
            pages.append(page)
            all_text.append(page.text)
            total_confidence += page.confidence
        
        avg_confidence = total_confidence / len(pages) if pages else 0.0
        
        return OCRResult(
            pages=pages,
            full_text="\n\n".join(all_text),
            avg_confidence=avg_confidence
        )
    
    def _process_image(self, file_path: str, language: str) -> OCRResult:
        """Process an image file."""
        from PIL import Image
        
        image = Image.open(file_path)
        page = self._process_single_image(image, 0, language, file_path)
        
        return OCRResult(
            pages=[page],
            full_text=page.text,
            avg_confidence=page.confidence
        )
    
    def _process_single_image(
        self, 
        image, 
        page_number: int, 
        language: str,
        image_path: str
    ) -> OCRPage:
        """Process a single image and extract OCR data."""
        import pytesseract
        from pytesseract import Output
        
        width, height = image.size
        
        # Get detailed OCR data
        data = pytesseract.image_to_data(
            image, 
            lang=language, 
            output_type=Output.DICT
        )
        
        # Build lines and words
        lines = []
        current_line = None
        current_line_words = []
        
        for i, text in enumerate(data['text']):
            if not text.strip():
                continue
            
            confidence = data['conf'][i]
            if confidence < 0:  # Skip invalid entries
                continue
            
            word = OCRWord(
                text=text,
                confidence=confidence / 100.0,
                bbox=BoundingBox(
                    x=data['left'][i],
                    y=data['top'][i],
                    width=data['width'][i],
                    height=data['height'][i],
                    page=page_number
                )
            )
            
            line_num = data['line_num'][i]
            
            if current_line is None or line_num != current_line:
                if current_line_words:
                    lines.append(self._create_line(current_line_words, page_number))
                current_line = line_num
                current_line_words = [word]
            else:
                current_line_words.append(word)
        
        # Add last line
        if current_line_words:
            lines.append(self._create_line(current_line_words, page_number))
        
        # Calculate average confidence
        all_confidences = [w.confidence for line in lines for w in line.words]
        avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
        
        # Full text
        full_text = pytesseract.image_to_string(image, lang=language)
        
        return OCRPage(
            page_number=page_number,
            width=width,
            height=height,
            text=full_text,
            confidence=avg_conf,
            lines=lines,
            image_path=image_path
        )
    
    def _create_line(self, words: List[OCRWord], page: int) -> OCRLine:
        """Create an OCRLine from a list of words."""
        text = ' '.join(w.text for w in words)
        avg_conf = sum(w.confidence for w in words) / len(words)
        
        # Calculate bounding box for entire line
        min_x = min(w.bbox.x for w in words)
        min_y = min(w.bbox.y for w in words)
        max_x = max(w.bbox.x + w.bbox.width for w in words)
        max_y = max(w.bbox.y + w.bbox.height for w in words)
        
        return OCRLine(
            text=text,
            confidence=avg_conf,
            bbox=BoundingBox(
                x=min_x,
                y=min_y,
                width=max_x - min_x,
                height=max_y - min_y,
                page=page
            ),
            words=words
        )
    
    def extract_text_from_region(
        self, 
        image_path: str, 
        bbox: BoundingBox,
        language: str = 'nld+eng'
    ) -> str:
        """Extract text from a specific region."""
        import pytesseract
        from PIL import Image
        
        image = Image.open(image_path)
        
        # Crop to region
        cropped = image.crop((
            bbox.x,
            bbox.y,
            bbox.x + bbox.width,
            bbox.y + bbox.height
        ))
        
        # OCR the cropped region
        text = pytesseract.image_to_string(cropped, lang=language)
        return text.strip()


class InvoiceDataExtractor:
    """
    Extracts structured data from OCR results using patterns.
    """
    
    # Common Dutch invoice patterns
    PATTERNS = {
        'invoice_number': [
            r'Factuurnummer[:\s]*([A-Z0-9-]+)',
            r'Invoice\s*(?:no|number|nr)?[:\s]*([A-Z0-9-]+)',
            r'Factuur\s*(?:no|nummer|nr)?[:\s]*([A-Z0-9-]+)',
            r'FNR[:\s]*([A-Z0-9-]+)',
        ],
        'invoice_date': [
            r'Factuurdatum[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
            r'Invoice\s*date[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
            r'Datum[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
            r'Date[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
        ],
        'due_date': [
            r'Vervaldatum[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
            r'Due\s*date[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
            r'Betalen\s*voor[:\s]*(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})',
        ],
        'total': [
            r'Totaal[:\s]*€?\s*([\d.,]+)',
            r'Total[:\s]*€?\s*([\d.,]+)',
            r'Te\s*betalen[:\s]*€?\s*([\d.,]+)',
            r'Amount\s*due[:\s]*€?\s*([\d.,]+)',
        ],
        'subtotal': [
            r'Subtotaal[:\s]*€?\s*([\d.,]+)',
            r'Subtotal[:\s]*€?\s*([\d.,]+)',
            r'Netto[:\s]*€?\s*([\d.,]+)',
        ],
        'vat_amount': [
            r'BTW[:\s]*€?\s*([\d.,]+)',
            r'VAT[:\s]*€?\s*([\d.,]+)',
            r'BTW\s*\d+%[:\s]*€?\s*([\d.,]+)',
        ],
        'vat_percentage': [
            r'BTW\s*(\d+(?:[.,]\d+)?)\s*%',
            r'VAT\s*(\d+(?:[.,]\d+)?)\s*%',
            r'(\d+(?:[.,]\d+)?)\s*%\s*BTW',
        ],
        'iban': [
            r'([A-Z]{2}\d{2}[A-Z0-9]{4}\d{10})',
            r'IBAN[:\s]*([A-Z]{2}\s?\d{2}\s?[A-Z0-9]{4}\s?\d{4}\s?\d{4}\s?\d{2})',
        ],
        'kvk': [
            r'KVK[:\s-]*(\d{8})',
            r'KvK[:\s-]*(\d{8})',
            r'Kamer\s*van\s*Koophandel[:\s]*(\d{8})',
        ],
        'btw_nummer': [
            r'BTW[:\s-]*([A-Z]{2}\d{9}B\d{2})',
            r'BTW-nummer[:\s]*([A-Z]{2}\d{9}B\d{2})',
            r'VAT[:\s-]*([A-Z]{2}\d{9}B\d{2})',
        ],
    }
    
    def extract_all_fields(self, text: str) -> Dict[str, Any]:
        """Extract all known fields from text."""
        extracted = {}
        
        for field_name, patterns in self.PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    extracted[field_name] = self._parse_value(field_name, value)
                    break
        
        return extracted
    
    def _parse_value(self, field_name: str, value: str) -> Any:
        """Parse a value based on field type."""
        if field_name in ['total', 'subtotal', 'vat_amount']:
            return self._parse_currency(value)
        elif field_name in ['vat_percentage']:
            return self._parse_percentage(value)
        elif field_name in ['invoice_date', 'due_date']:
            return self._parse_date(value)
        elif field_name == 'iban':
            return value.replace(' ', '').upper()
        else:
            return value
    
    def _parse_currency(self, value: str) -> Optional[Decimal]:
        """Parse a currency string to Decimal."""
        try:
            # Remove currency symbols and spaces
            value = re.sub(r'[€$\s]', '', value)
            # Handle Dutch number format (1.234,56)
            if ',' in value and '.' in value:
                value = value.replace('.', '').replace(',', '.')
            elif ',' in value:
                value = value.replace(',', '.')
            return Decimal(value)
        except:
            return None
    
    def _parse_percentage(self, value: str) -> Optional[Decimal]:
        """Parse a percentage string."""
        try:
            value = value.replace(',', '.')
            return Decimal(value)
        except:
            return None
    
    def _parse_date(self, value: str) -> Optional[str]:
        """Parse a date string to ISO format."""
        date_formats = [
            '%d-%m-%Y', '%d/%m/%Y', '%d.%m.%Y',
            '%d-%m-%y', '%d/%m/%y', '%d.%m.%y',
            '%Y-%m-%d',
        ]
        
        for fmt in date_formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        return value
    
    def find_line_items(self, ocr_result: OCRResult) -> List[Dict]:
        """
        Attempt to find line items in the invoice.
        This is a heuristic approach - patterns improve this.
        """
        line_items = []
        
        for page in ocr_result.pages:
            # Look for table-like structures
            lines = page.lines
            
            # Find potential header row
            header_idx = None
            for i, line in enumerate(lines):
                lower_text = line.text.lower()
                if any(kw in lower_text for kw in ['omschrijving', 'description', 'artikel', 'product']):
                    if any(kw in lower_text for kw in ['aantal', 'quantity', 'qty', 'prijs', 'price']):
                        header_idx = i
                        break
            
            if header_idx is not None:
                # Extract lines after header
                for line in lines[header_idx + 1:]:
                    # Skip if looks like a total row
                    if any(kw in line.text.lower() for kw in ['totaal', 'total', 'subtotal', 'btw']):
                        break
                    
                    # Try to parse as line item
                    item = self._parse_line_item(line.text)
                    if item:
                        item['position'] = line.bbox.to_dict()
                        line_items.append(item)
        
        return line_items
    
    def _parse_line_item(self, text: str) -> Optional[Dict]:
        """Try to parse a text line as an invoice line item."""
        # Very basic parsing - patterns make this more accurate
        parts = text.split()
        if len(parts) < 2:
            return None
        
        # Look for numbers that might be quantities or prices
        numbers = re.findall(r'[\d.,]+', text)
        
        if not numbers:
            return None
        
        # Assume last number is total, second to last is price, etc.
        return {
            'raw_text': text,
            'numbers_found': numbers,
        }


class PatternMatcher:
    """
    Matches invoices to known patterns and applies learned extraction rules.
    """
    
    def __init__(self):
        self.ocr_engine = OCREngine()
        self.extractor = InvoiceDataExtractor()
    
    def find_matching_pattern(self, ocr_result: OCRResult, company_id: str = None):
        """
        Find a pattern that matches this invoice.
        
        Returns the best matching pattern or None.
        """
        from .models import InvoicePattern
        
        # Get patterns to try
        patterns = InvoicePattern.objects.filter(is_active=True)
        if company_id:
            patterns = patterns.filter(company_id=company_id)
        patterns = patterns.order_by('-accuracy_score', '-times_used')
        
        best_match = None
        best_score = 0.0
        
        for pattern in patterns:
            score = self._calculate_match_score(ocr_result, pattern)
            if score > best_score and score > 0.5:  # Minimum 50% match
                best_score = score
                best_match = pattern
        
        return best_match
    
    def _calculate_match_score(self, ocr_result: OCRResult, pattern) -> float:
        """
        Calculate how well an OCR result matches a pattern.
        """
        score = 0.0
        total_checks = 0
        
        visual_sig = pattern.visual_signature or {}
        
        # Check for signature keywords
        keywords = visual_sig.get('keywords', [])
        if keywords:
            found = 0
            for kw in keywords:
                if kw.lower() in ocr_result.full_text.lower():
                    found += 1
            if keywords:
                score += (found / len(keywords)) * 0.5
                total_checks += 0.5
        
        # Check company name in text
        if hasattr(pattern, 'company') and pattern.company:
            company_name = pattern.company.naam.lower()
            if company_name in ocr_result.full_text.lower():
                score += 0.3
            total_checks += 0.3
        
        # More checks can be added (logo detection, layout analysis, etc.)
        
        return score / total_checks if total_checks > 0 else 0.0
    
    def extract_with_pattern(
        self, 
        ocr_result: OCRResult, 
        pattern,
        image_paths: List[str]
    ) -> Dict[str, Any]:
        """
        Extract invoice data using a learned pattern.
        """
        extracted = {}
        
        for mapping in pattern.field_mappings.filter(is_active=True):
            value = self._extract_field(ocr_result, mapping, image_paths)
            if value is not None:
                extracted[mapping.field_type] = value
        
        return extracted
    
    def _extract_field(self, ocr_result: OCRResult, mapping, image_paths: List[str]) -> Any:
        """Extract a single field using its mapping configuration."""
        method = mapping.extraction_method
        config = mapping.config or {}
        
        if method == 'regex':
            pattern = config.get('pattern')
            if pattern:
                match = re.search(pattern, ocr_result.full_text, re.IGNORECASE)
                if match:
                    return match.group(1) if match.groups() else match.group(0)
        
        elif method == 'region':
            bbox = BoundingBox.from_dict(config)
            if bbox.page < len(image_paths):
                text = self.ocr_engine.extract_text_from_region(
                    image_paths[bbox.page],
                    bbox
                )
                return text
        
        elif method == 'keyword_after':
            keyword = config.get('keyword', '')
            offset = config.get('offset', 0)
            # Find keyword and extract text after it
            pattern = rf'{re.escape(keyword)}[:\s]*(.+?)(?:\n|$)'
            match = re.search(pattern, ocr_result.full_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        elif method == 'keyword_below':
            keyword = config.get('keyword', '')
            # Find keyword in lines and get next line
            for page in ocr_result.pages:
                for i, line in enumerate(page.lines):
                    if keyword.lower() in line.text.lower():
                        if i + 1 < len(page.lines):
                            return page.lines[i + 1].text.strip()
        
        return None


class InvoiceImportService:
    """
    Main service for importing invoices via OCR.
    """
    
    def __init__(self):
        self.ocr_engine = OCREngine()
        self.extractor = InvoiceDataExtractor()
        self.pattern_matcher = PatternMatcher()
    
    def process_upload(self, file: UploadedFile, user) -> 'InvoiceImport':
        """
        Process an uploaded invoice file.
        
        Args:
            file: The uploaded file
            user: The user who uploaded the file
            
        Returns:
            InvoiceImport instance with extraction results
        """
        from .models import InvoiceImport
        
        # Create import record
        invoice_import = InvoiceImport.objects.create(
            original_file=file,
            file_name=file.name,
            file_type=Path(file.name).suffix.lower()[1:],  # Remove dot
            file_size=file.size,
            status=InvoiceImport.Status.PROCESSING,
            uploaded_by=user
        )
        
        try:
            # Run OCR
            ocr_result = self.ocr_engine.process_file(
                invoice_import.original_file.path
            )
            
            invoice_import.ocr_text = ocr_result.full_text
            invoice_import.ocr_confidence = ocr_result.avg_confidence
            
            # Try pattern matching first
            pattern = self.pattern_matcher.find_matching_pattern(ocr_result)
            
            if pattern:
                # Use learned pattern
                image_paths = [p.image_path for p in ocr_result.pages if p.image_path]
                extracted = self.pattern_matcher.extract_with_pattern(
                    ocr_result, 
                    pattern,
                    image_paths
                )
                invoice_import.matched_pattern = pattern
            else:
                # Fall back to generic extraction
                extracted = self.extractor.extract_all_fields(ocr_result.full_text)
            
            # Extract line items
            line_items = self.extractor.find_line_items(ocr_result)
            
            # Store results
            invoice_import.extracted_data = {
                'fields': extracted,
                'line_items': line_items,
                'ocr_pages': [p.to_dict() for p in ocr_result.pages],
            }
            
            invoice_import.status = InvoiceImport.Status.EXTRACTED
            invoice_import.save()
            
            # Create line records
            from .models import ImportedInvoiceLine
            for i, item in enumerate(line_items):
                ImportedInvoiceLine.objects.create(
                    invoice_import=invoice_import,
                    raw_text=item.get('raw_text', ''),
                    position=item.get('position', {}),
                    volgorde=i
                )
            
        except Exception as e:
            logger.exception(f"Error processing invoice: {e}")
            invoice_import.status = InvoiceImport.Status.FAILED
            invoice_import.error_message = str(e)
            invoice_import.save()
        
        return invoice_import
    
    def apply_corrections(self, invoice_import, corrections: Dict) -> None:
        """
        Apply user corrections and update patterns.
        
        Args:
            invoice_import: The InvoiceImport instance
            corrections: Dict with field corrections
        """
        from django.utils import timezone
        
        # Store corrections
        invoice_import.user_corrections = corrections
        invoice_import.save(update_fields=['user_corrections'])
        
        # Update pattern if one was matched
        if invoice_import.matched_pattern:
            pattern = invoice_import.matched_pattern
            pattern.times_used += 1
            
            if corrections:
                pattern.times_corrected += 1
                # Update field mappings based on corrections
                self._update_pattern_from_corrections(pattern, corrections, invoice_import)
            
            pattern.last_used_at = timezone.now()
            pattern.update_accuracy()
    
    def _update_pattern_from_corrections(self, pattern, corrections: Dict, invoice_import) -> None:
        """Update pattern field mappings based on user corrections."""
        from .models import FieldMapping
        
        for field_name, correction in corrections.items():
            # Find existing mapping
            mapping = pattern.field_mappings.filter(field_type=field_name).first()
            
            if mapping:
                mapping.incorrect_extractions += 1
                mapping.save(update_fields=['incorrect_extractions'])
            
            # If correction includes a region, create/update region mapping
            if 'region' in correction:
                FieldMapping.objects.update_or_create(
                    pattern=pattern,
                    field_type=field_name,
                    extraction_method='region',
                    defaults={
                        'config': correction['region'],
                        'priority': 10,  # Higher priority for user-defined
                    }
                )
    
    def create_pattern_from_import(
        self, 
        invoice_import, 
        company,
        name: str,
        keywords: List[str] = None
    ):
        """
        Create a new pattern from a completed import.
        """
        from .models import InvoicePattern, FieldMapping
        
        pattern = InvoicePattern.objects.create(
            name=name,
            company=company,
            visual_signature={
                'keywords': keywords or [],
            }
        )
        
        # Create field mappings from extracted data and corrections
        extracted = invoice_import.extracted_data.get('fields', {})
        corrections = invoice_import.user_corrections or {}
        
        # Merge extracted with corrections (corrections take priority)
        all_fields = {**extracted, **corrections}
        
        for field_name, value in all_fields.items():
            if isinstance(value, dict) and 'region' in value:
                # Region-based extraction
                FieldMapping.objects.create(
                    pattern=pattern,
                    field_type=field_name,
                    extraction_method='region',
                    config=value['region']
                )
            else:
                # Try to create regex pattern from value
                if value:
                    # Simple keyword-based extraction for now
                    FieldMapping.objects.create(
                        pattern=pattern,
                        field_type=field_name,
                        extraction_method='keyword_after',
                        config={
                            'keyword': field_name.replace('_', ' ').title()
                        }
                    )
        
        invoice_import.matched_pattern = pattern
        invoice_import.save(update_fields=['matched_pattern'])
        
        return pattern
