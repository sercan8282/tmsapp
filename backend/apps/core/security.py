"""
Security utilities for TMS application.
Input sanitization, XSS prevention, and validation helpers.
"""
import re
import html
import bleach
from typing import Optional, List
from django.core.validators import validate_email
from django.core.exceptions import ValidationError


# Allowed HTML tags for rich text fields (e.g., invoice notes)
ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li']
ALLOWED_ATTRIBUTES = {}


def sanitize_html(value: str) -> str:
    """
    Sanitize HTML content, allowing only safe tags.
    Use for rich text fields like invoice notes.
    """
    if not value:
        return value
    
    return bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )


def escape_html(value: str) -> str:
    """
    Escape all HTML characters.
    Use for plain text fields that should never contain HTML.
    """
    if not value:
        return value
    
    return html.escape(value)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal and other attacks.
    """
    if not filename:
        return filename
    
    # Remove path separators
    filename = filename.replace('/', '').replace('\\', '')
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Remove leading dots (hidden files)
    filename = filename.lstrip('.')
    
    # Only allow safe characters
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:250] + ('.' + ext if ext else '')
    
    return filename or 'unnamed'


def sanitize_search_query(query: str) -> str:
    """
    Sanitize search query to prevent SQL injection in LIKE clauses.
    """
    if not query:
        return query
    
    # Escape SQL wildcards
    query = query.replace('%', r'\%').replace('_', r'\_')
    
    # Remove potential SQL commands
    sql_patterns = [
        r'--', r';', r'/*', r'*/', r'@@', r'@',
        r'char', r'nchar', r'varchar', r'nvarchar',
        r'alter', r'begin', r'cast', r'create', r'cursor',
        r'declare', r'delete', r'drop', r'end', r'exec',
        r'execute', r'fetch', r'insert', r'kill', r'select',
        r'sys', r'sysobjects', r'syscolumns', r'table',
        r'update', r'union', r'information_schema'
    ]
    
    query_lower = query.lower()
    for pattern in sql_patterns:
        if pattern in query_lower:
            query = re.sub(re.escape(pattern), '', query, flags=re.IGNORECASE)
    
    return query.strip()


def validate_dutch_phone(phone: str) -> bool:
    """
    Validate Dutch phone number format.
    """
    if not phone:
        return True  # Empty is valid (field might be optional)
    
    # Remove common separators
    cleaned = re.sub(r'[\s\-\.]', '', phone)
    
    # Dutch phone patterns
    patterns = [
        r'^(\+31|0031|31)?[1-9][0-9]{8}$',  # Mobile or landline
        r'^0[1-9][0-9]{8}$',  # National format
    ]
    
    return any(re.match(p, cleaned) for p in patterns)


def validate_dutch_kvk(kvk: str) -> bool:
    """
    Validate Dutch KvK (Chamber of Commerce) number.
    Must be 8 digits.
    """
    if not kvk:
        return True  # Empty is valid
    
    cleaned = re.sub(r'\s', '', kvk)
    return bool(re.match(r'^\d{8}$', cleaned))


def validate_dutch_postcode(postcode: str) -> bool:
    """
    Validate Dutch postcode format (1234 AB).
    """
    if not postcode:
        return True
    
    cleaned = re.sub(r'\s', '', postcode).upper()
    return bool(re.match(r'^[1-9][0-9]{3}[A-Z]{2}$', cleaned))


def validate_license_plate(plate: str) -> bool:
    """
    Validate Dutch license plate format.
    Various formats are valid depending on registration date.
    """
    if not plate:
        return True
    
    cleaned = re.sub(r'[\s\-]', '', plate).upper()
    
    # Common Dutch plate patterns
    patterns = [
        r'^[A-Z]{2}[0-9]{2}[A-Z]{2}$',  # XX-99-XX
        r'^[0-9]{2}[A-Z]{2}[A-Z]{2}$',  # 99-XX-XX
        r'^[0-9]{2}[A-Z]{3}[0-9]{1}$',  # 99-XXX-9
        r'^[0-9]{1}[A-Z]{3}[0-9]{2}$',  # 9-XXX-99
        r'^[A-Z]{2}[0-9]{3}[A-Z]{1}$',  # XX-999-X
        r'^[A-Z]{1}[0-9]{3}[A-Z]{2}$',  # X-999-XX
        r'^[A-Z]{3}[0-9]{2}[A-Z]{1}$',  # XXX-99-X
    ]
    
    return any(re.match(p, cleaned) for p in patterns)


def validate_safe_url(url: str) -> bool:
    """
    Validate URL is safe (no javascript:, data:, etc).
    """
    if not url:
        return True
    
    url_lower = url.lower().strip()
    
    # Block dangerous protocols
    dangerous = ['javascript:', 'data:', 'vbscript:', 'file:']
    
    return not any(url_lower.startswith(d) for d in dangerous)


def validate_positive_number(value: float, allow_zero: bool = False) -> bool:
    """
    Validate that a number is positive (or zero if allowed).
    """
    if allow_zero:
        return value >= 0
    return value > 0


def strip_and_clean(value: str) -> str:
    """
    Strip whitespace and normalize internal spaces.
    """
    if not value:
        return value
    
    # Strip leading/trailing whitespace
    value = value.strip()
    
    # Normalize internal whitespace
    value = re.sub(r'\s+', ' ', value)
    
    return value


class InputSanitizer:
    """
    Mixin for serializers to add automatic input sanitization.
    """
    
    # Fields to sanitize as plain text (escape HTML)
    TEXT_FIELDS = []
    
    # Fields to sanitize as rich text (allow some HTML)
    RICH_TEXT_FIELDS = []
    
    # Fields to sanitize as filenames
    FILENAME_FIELDS = []
    
    def to_internal_value(self, data):
        """Override to sanitize input data."""
        data = super().to_internal_value(data)
        
        for field in self.TEXT_FIELDS:
            if field in data and isinstance(data[field], str):
                data[field] = escape_html(strip_and_clean(data[field]))
        
        for field in self.RICH_TEXT_FIELDS:
            if field in data and isinstance(data[field], str):
                data[field] = sanitize_html(data[field])
        
        for field in self.FILENAME_FIELDS:
            if field in data and isinstance(data[field], str):
                data[field] = sanitize_filename(data[field])
        
        return data
