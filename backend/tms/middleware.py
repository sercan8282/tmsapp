"""
Custom middleware for TMS application.
"""


class MediaXFrameOptionsMiddleware:
    """
    Middleware that removes X-Frame-Options header for media files.
    This allows PDFs and images to be embedded in iframes from the frontend.
    
    This is safe because:
    - Media files are static content (no clickjacking risk)
    - The files are served from /media/ URLs only
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Remove X-Frame-Options for media files to allow embedding
        if request.path.startswith('/media/'):
            # Delete the header if it exists
            if 'X-Frame-Options' in response:
                del response['X-Frame-Options']
        
        return response
