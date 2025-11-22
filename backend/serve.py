"""
Production server script using Waitress
"""
import os
import sys
from waitress import serve

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')

# Import Django's WSGI application
from travello_backend.travello_backend.wsgi import application

if __name__ == '__main__':
    print("Starting Travello Backend on http://0.0.0.0:8000")
    print("Press CTRL+C to stop the server")
    serve(application, host='0.0.0.0', port=8000, threads=4)
