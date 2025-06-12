import logging
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger('backend')

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first
    response = drf_exception_handler(exc, context)

    # Log the exception with full traceback
    logger.exception('Exception occurred', exc_info=exc)

    return response
