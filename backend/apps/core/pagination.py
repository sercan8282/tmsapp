"""Custom pagination classes."""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class SafePageNumberPagination(PageNumberPagination):
    """
    Custom pagination that doesn't raise 404 for out-of-range pages.
    Instead, it returns the last valid page or an empty result.
    """
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        """
        Override to handle out-of-range pages gracefully.
        """
        from django.core.paginator import InvalidPage
        
        page_size = self.get_page_size(request)
        if not page_size:
            return None

        paginator = self.django_paginator_class(queryset, page_size)
        page_number = self.get_page_number(request, paginator)
        
        try:
            self.page = paginator.page(page_number)
        except InvalidPage:
            # If page is out of range, return empty results
            # This prevents 404 errors when filters change and reduce the page count
            self.page = None
            self.request = request
            return []
        
        if paginator.num_pages > 1 and self.template is not None:
            # The browsable API should display pagination controls.
            self.display_page_controls = True

        self.request = request
        return list(self.page)

    def get_paginated_response(self, data):
        """Return paginated response with null-safe handling."""
        if self.page is None:
            return Response({
                'count': 0,
                'next': None,
                'previous': None,
                'results': []
            })
        
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })
