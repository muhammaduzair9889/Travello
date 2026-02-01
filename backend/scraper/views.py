"""
Django Views for Web Scraping API - Real-Time Only
"""
import logging
import subprocess
import os
import json
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt

from .booking_scraper import BookingScraper, PAKISTAN_DESTINATIONS

logger = logging.getLogger(__name__)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def scrape_hotels(request):
    """
    Scrape hotels from Booking.com - REAL-TIME DATA ONLY
    
    POST /api/scraper/scrape-hotels/
    
    Request Body:
    {
        "city": "Lahore",
        "dest_id": "-2767043",
        "checkin": "2026-02-02",
        "checkout": "2026-02-07",
        "adults": 2,
        "rooms": 1,
        "children": 0,
        "use_cache": true
    }
    """
    try:
        logger.info(f"Received scrape request: {request.data}")
        
        # Extract search parameters
        search_params = {
            'city': request.data.get('city', 'Lahore'),
            'dest_id': request.data.get('dest_id'),
            'dest_type': request.data.get('dest_type', 'city'),
            'checkin': request.data.get('checkin'),
            'checkout': request.data.get('checkout'),
            'adults': request.data.get('adults', 2),
            'rooms': request.data.get('rooms', 1),
            'children': request.data.get('children', 0)
        }
        
        # Auto-detect destination ID for Pakistani cities
        city_lower = search_params['city'].lower()
        if not search_params['dest_id'] and city_lower in PAKISTAN_DESTINATIONS:
            search_params['dest_id'] = PAKISTAN_DESTINATIONS[city_lower]['dest_id']
            logger.info(f"Auto-detected dest_id for {search_params['city']}: {search_params['dest_id']}")
        
        # Check cache if requested
        use_cache = request.data.get('use_cache', True)
        cache_key = f"realtime_{search_params['city']}_{search_params['checkin']}_{search_params['checkout']}_{search_params.get('adults', 2)}"
        
        if use_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                logger.info(f"Returning cached real-time results ({len(cached_data)} hotels)")
                return Response({
                    'success': True,
                    'count': len(cached_data),
                    'hotels': cached_data,
                    'cached': True,
                    'is_real_time': True,
                    'data_source': 'booking.com',
                    'search_params': search_params
                })
        
        # REAL-TIME SCRAPING using Puppeteer
        logger.info(f"Starting REAL-TIME scraping from Booking.com...")
        hotels = []
        
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            puppeteer_script = os.path.join(current_dir, 'puppeteer_scraper.js')
            params_json = json.dumps(search_params)
            
            logger.info(f"Running Puppeteer scraper...")
            
            result = subprocess.run(
                ['node', puppeteer_script, params_json],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=current_dir,
                encoding='utf-8',  # Fix Windows encoding issue
                errors='replace'   # Replace undecodable chars instead of crashing
            )
            
            # Parse JSON output
            stdout_lines = result.stdout.strip().split('\n')
            for line in reversed(stdout_lines):
                try:
                    json_output = json.loads(line)
                    if isinstance(json_output, list):
                        hotels = json_output
                        break
                except json.JSONDecodeError:
                    continue
            
            if hotels:
                logger.info(f"Real-time scraping successful! Found {len(hotels)} hotels")
            else:
                logger.warning(f"No hotels found. stderr: {result.stderr[:500] if result.stderr else 'None'}")
                
        except subprocess.TimeoutExpired:
            logger.error("Real-time scraping timed out after 120 seconds")
        except FileNotFoundError:
            logger.error("Node.js not found. Install Node.js for real-time scraping")
        except Exception as e:
            logger.error(f"Real-time scraping error: {str(e)}")
        
        # Return only real-time data - NO STATIC FALLBACK
        if not hotels:
            return Response({
                'success': False,
                'count': 0,
                'hotels': [],
                'cached': False,
                'is_real_time': False,
                'data_source': 'none',
                'message': 'Unable to fetch real-time data from Booking.com. Please try again.',
                'search_params': search_params
            })
        
        # Cache real-time results for 30 minutes
        cache.set(cache_key, hotels, 1800)
        
        return Response({
            'success': True,
            'count': len(hotels),
            'hotels': hotels,
            'cached': False,
            'is_real_time': True,
            'data_source': 'booking.com',
            'search_params': search_params
        })
        
    except Exception as e:
        logger.error(f"Error in scrape_hotels: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to scrape hotels.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_destinations(request):
    """Get list of supported Pakistani cities with their destination IDs"""
    destinations = [
        {
            'city': dest['name'],
            'dest_id': dest['dest_id'],
            'country': dest['country'],
            'key': key
        }
        for key, dest in PAKISTAN_DESTINATIONS.items()
    ]
    
    return Response({
        'success': True,
        'destinations': destinations
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def test_scraper(request):
    """Test scraper setup and configuration"""
    try:
        import shutil
        node_available = shutil.which('node') is not None
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        puppeteer_script = os.path.join(current_dir, 'puppeteer_scraper.js')
        script_exists = os.path.exists(puppeteer_script)
        
        return Response({
            'success': True,
            'node_available': node_available,
            'puppeteer_script_exists': script_exists,
            'message': 'Ready for real-time scraping' if (node_available and script_exists) else 'Setup required',
            'instructions': {
                'node': 'Install Node.js from https://nodejs.org',
                'puppeteer': 'cd backend/scraper && npm install'
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
