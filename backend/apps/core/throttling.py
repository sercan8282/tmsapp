"""
Custom throttling classes for rate limiting.
"""
from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    """
    Rate limit for login attempts.
    More restrictive than general user rate limits.
    """
    scope = 'login'
    
    def get_cache_key(self, request, view):
        # Use IP address for anonymous login attempts
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class PasswordResetRateThrottle(SimpleRateThrottle):
    """
    Rate limit for password reset requests.
    Prevents email bombing and enumeration.
    """
    scope = 'password_reset'
    
    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class MFAVerifyRateThrottle(SimpleRateThrottle):
    """
    Rate limit for MFA verification attempts.
    Prevents brute force attacks on TOTP codes.
    """
    scope = 'mfa_verify'
    
    def get_cache_key(self, request, view):
        # Use user ID if authenticated, otherwise IP
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class BurstRateThrottle(SimpleRateThrottle):
    """
    Prevents burst requests (many requests in short time).
    """
    scope = 'burst'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class DocumentEmailRateThrottle(SimpleRateThrottle):
    """
    Rate limit for document email sending.
    Prevents email spam/abuse.
    """
    scope = 'document_email'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class DocumentSignRateThrottle(SimpleRateThrottle):
    """
    Rate limit for document signing.
    Prevents abuse of signature processing.
    """
    scope = 'document_sign'
    
    def get_cache_key(self, request, view):
        if request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
