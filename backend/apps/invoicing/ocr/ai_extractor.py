"""
AI-powered Invoice Data Extraction using OpenAI/Azure OpenAI/GitHub Models

This module provides intelligent extraction of invoice data using LLMs,
which is much more robust than regex-based parsing for various invoice formats.

Supported providers (in order of priority):
1. Database settings (configured via admin panel)
2. Environment variables (.env file) as fallback

Providers:
- GitHub Models (FREE) - requires GITHUB_TOKEN
- Azure OpenAI - requires endpoint and API key
- OpenAI - requires API key
"""
import json
import logging
from typing import Dict, List, Optional
from decimal import Decimal

try:
    from decouple import config
except ImportError:
    # Fallback to os.getenv if decouple not available
    import os
    config = lambda key, default='': os.getenv(key, default)

logger = logging.getLogger(__name__)

# GitHub Models endpoint (FREE)
GITHUB_MODELS_ENDPOINT = "https://models.inference.ai.azure.com"


def get_ai_settings_from_db():
    """
    Get AI configuration from database (AppSettings).
    Returns None if not configured or database not available.
    """
    try:
        from apps.core.models import AppSettings
        settings = AppSettings.get_settings()
        
        if settings.ai_provider == 'none':
            return None
            
        return {
            'provider': settings.ai_provider,
            'github_token': settings.ai_github_token,
            'openai_api_key': settings.ai_openai_api_key,
            'azure_endpoint': settings.ai_azure_endpoint,
            'azure_api_key': settings.ai_azure_api_key,
            'azure_deployment': settings.ai_azure_deployment,
            'model': settings.ai_model,
        }
    except Exception as e:
        logger.debug(f"Could not load AI settings from database: {e}")
        return None


class AIInvoiceExtractor:
    """
    AI-powered invoice data extractor using OpenAI GPT models.
    Supports GitHub Models (free), Azure OpenAI, and OpenAI.
    
    Configuration priority:
    1. Database settings (AppSettings model)
    2. Environment variables (.env file)
    """
    
    def __init__(self):
        # Try to load from database first
        db_settings = get_ai_settings_from_db()
        
        if db_settings:
            # Use database settings
            self._provider_config = db_settings['provider']
            self.github_token = db_settings['github_token'] if db_settings['provider'] == 'github' else ''
            self.azure_endpoint = db_settings['azure_endpoint'] if db_settings['provider'] == 'azure' else ''
            self.azure_api_key = db_settings['azure_api_key'] if db_settings['provider'] == 'azure' else ''
            self.azure_deployment = db_settings['azure_deployment'] or 'gpt-4o-mini'
            self.api_key = db_settings['openai_api_key'] if db_settings['provider'] == 'openai' else ''
            self.model = db_settings['model'] or 'gpt-4o-mini'
            logger.info(f"AI settings loaded from database (provider: {db_settings['provider']})")
        else:
            # Fallback to environment variables
            self._provider_config = None
            self.github_token = config('GITHUB_TOKEN', default='')
            self.azure_endpoint = config('AZURE_OPENAI_ENDPOINT', default='')
            self.azure_api_key = config('AZURE_OPENAI_API_KEY', default='')
            self.azure_deployment = config('AZURE_OPENAI_DEPLOYMENT', default='gpt-4o-mini')
            self.api_key = config('OPENAI_API_KEY', default='')
            self.model = config('OPENAI_MODEL', default='gpt-4o-mini')
            if self.github_token or self.api_key or self.azure_api_key:
                logger.info("AI settings loaded from environment variables")
        
        self._client = None
        self._provider = None
        
    @property
    def is_available(self) -> bool:
        """Check if AI extraction is available (any API key configured)."""
        return bool(
            self.github_token or 
            (self.azure_endpoint and self.azure_api_key) or 
            self.api_key
        )
    
    def _get_client(self):
        """Get or create the OpenAI client."""
        if self._client is not None:
            return self._client
            
        try:
            from openai import OpenAI, AzureOpenAI
            
            # Priority 1: GitHub Models (FREE)
            if self.github_token:
                self._client = OpenAI(
                    base_url=GITHUB_MODELS_ENDPOINT,
                    api_key=self.github_token
                )
                self._provider = "GitHub Models (FREE)"
                logger.info("Using GitHub Models (FREE) for invoice extraction")
            # Priority 2: Azure OpenAI
            elif self.azure_endpoint and self.azure_api_key:
                self._client = AzureOpenAI(
                    azure_endpoint=self.azure_endpoint,
                    api_key=self.azure_api_key,
                    api_version="2024-02-15-preview"
                )
                self._provider = "Azure OpenAI"
                logger.info("Using Azure OpenAI for invoice extraction")
            # Priority 3: OpenAI
            elif self.api_key:
                self._client = OpenAI(api_key=self.api_key)
                self._provider = "OpenAI"
                logger.info("Using OpenAI for invoice extraction")
            else:
                return None
                
            return self._client
        except ImportError:
            logger.warning("OpenAI package not installed. Run: pip install openai")
            return None
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            return None
    
    def extract_invoice_data(self, ocr_text: str) -> Optional[Dict]:
        """
        Extract structured invoice data from OCR text using AI.
        
        Args:
            ocr_text: The raw OCR text from the invoice
            
        Returns:
            Dict with extracted fields and line_items, or None if extraction fails
        """
        client = self._get_client()
        if not client:
            logger.info("AI extraction not available, falling back to regex")
            return None
        
        try:
            system_prompt = """Je bent een expert in het extraheren van factuurgegevens. 
Analyseer de gegeven factuur tekst en extraheer alle relevante informatie in JSON formaat.

BELANGRIJK:
- Gebruik Nederlandse veldnamen
- Bedragen als decimale getallen (zonder € symbool)
- Datums in formaat YYYY-MM-DD
- Als een veld niet gevonden kan worden, gebruik null

Retourneer ALLEEN valide JSON in dit exacte formaat:
{
    "factuurnummer": "string of null",
    "factuurdatum": "YYYY-MM-DD of null",
    "vervaldatum": "YYYY-MM-DD of null",
    "leverancier": {
        "naam": "string",
        "adres": "string of null",
        "kvk": "string of null",
        "btw_nummer": "string of null",
        "iban": "string of null"
    },
    "subtotaal": number of null,
    "btw_percentage": number of null,
    "btw_bedrag": number of null,
    "totaal": number,
    "regels": [
        {
            "omschrijving": "string",
            "aantal": number,
            "eenheid": "string (stuk, uur, km, etc.)",
            "prijs_per_eenheid": number,
            "totaal": number
        }
    ]
}"""

            user_prompt = f"""Extraheer alle factuurgegevens uit deze tekst:

---
{ocr_text}
---

Retourneer ALLEEN de JSON, geen andere tekst."""

            # Determine which model to use
            model = self.azure_deployment if self.azure_endpoint else self.model
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content
            
            # Parse the JSON response
            try:
                result = json.loads(result_text)
                logger.info(f"AI extraction successful: {len(result.get('regels', []))} line items found")
                return self._normalize_result(result)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response as JSON: {e}")
                logger.debug(f"Response was: {result_text}")
                return None
                
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return None
    
    def _normalize_result(self, result: Dict) -> Dict:
        """
        Normalize the AI extraction result to match expected format.
        """
        # Convert to the format expected by the rest of the system
        normalized = {
            'fields': {
                'invoice_number': result.get('factuurnummer'),
                'invoice_date': result.get('factuurdatum'),
                'due_date': result.get('vervaldatum'),
                'subtotal': result.get('subtotaal'),
                'vat_percentage': result.get('btw_percentage'),
                'vat_amount': result.get('btw_bedrag'),
                'total': result.get('totaal'),
            },
            'line_items': [],
            'leverancier': result.get('leverancier', {}),
        }
        
        # Add supplier info to fields
        leverancier = result.get('leverancier', {})
        if leverancier:
            normalized['fields']['supplier_name'] = leverancier.get('naam')
            normalized['fields']['supplier_address'] = leverancier.get('adres')
            normalized['fields']['supplier_kvk'] = leverancier.get('kvk')
            normalized['fields']['supplier_vat'] = leverancier.get('btw_nummer')
            normalized['fields']['iban'] = leverancier.get('iban')
        
        # Convert line items
        for regel in result.get('regels', []):
            normalized['line_items'].append({
                'omschrijving': regel.get('omschrijving', ''),
                'aantal': regel.get('aantal', 1),
                'eenheid': regel.get('eenheid', 'stuk'),
                'prijs_per_eenheid': regel.get('prijs_per_eenheid', 0),
                'totaal': regel.get('totaal', 0),
                'raw_text': regel.get('omschrijving', ''),
            })
        
        return normalized
    
    def extract_line_items_only(self, ocr_text: str) -> List[Dict]:
        """
        Extract only line items from OCR text.
        Useful when header fields are already extracted.
        """
        result = self.extract_invoice_data(ocr_text)
        if result:
            return result.get('line_items', [])
        return []


# Singleton instance for easy import
ai_extractor = AIInvoiceExtractor()
