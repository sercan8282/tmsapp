"""  
Custom middleware for TMS application.
"""


class MediaXFrameOptionsMiddleware:
    """
    Middleware that sets X-Frame-Options to SAMEORIGIN for media files.
    This allows PDFs and images to be embedded in iframes from the same origin
    while still preventing embedding from external sites.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Set SAMEORIGIN for media files to allow same-origin embedding
        if request.path.startswith('/media/'):
            response['X-Frame-Options'] = 'SAMEORIGIN'
            # Prevent MIME sniffing of uploaded files
            response['X-Content-Type-Options'] = 'nosniff'
        
        return response
