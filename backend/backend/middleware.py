import logging

logger = logging.getLogger('backend')

class ExceptionLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_exception(self, request, exception):
        logger.exception("Unhandled exception caught by middleware")
        # Optionally, you can log additional request details here
        return None  # Continue processing the exception
