"""
Auto-detect which settings to use
"""
import os

# Check environment variable
environment = os.getenv('DJANGO_ENV', 'local')

if environment == 'production':
    from .production import *
    print("🚀 Using PRODUCTION settings")
else:
    from .local import *
    print("🛠️  Using LOCAL settings")