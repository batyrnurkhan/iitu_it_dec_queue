import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

logger = logging.getLogger('backend')

@csrf_exempt
def log_error(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            message = data.get('message', 'No message provided')
            logger.error(message)
            print("Log message received and logged:", message)  # Debug print
            return JsonResponse({'status': 'success'}, status=200)
        except Exception as e:
            logger.exception("Exception occurred in log_error view")
            print(f"Error logging message: {e}")  # Debug print
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=405)
