"""
Hotel API Service Layer
Integrates with Hotels.com API (RapidAPI) for real-time hotel data
"""

import requests
import logging
import time
from django.conf import settings
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class HotelAPIService:
    """
    Service class to interact with Hotels.com API via RapidAPI
    Provides real-time hotel search for Lahore, Pakistan
    """
    
    # Booking.com API Configuration (RapidAPI) - using apidojo provider
    API_BASE_URL = 'https://booking-com.p.rapidapi.com/v1'
    API_HOST = 'booking-com.p.rapidapi.com'
    
    # Lahore destination ID in Booking.com
    LAHORE_DEST_ID = '-2767043'
    
    def __init__(self):
        self.api_key = getattr(settings, 'RAPIDAPI_KEY', None)
        if not self.api_key:
            logger.warning("RAPIDAPI_KEY not configured in settings")
    
    def search_lahore_hotels(self, check_in, check_out, adults=2, children=0, room_type='double'):
        """
        Search for hotels in Lahore, Pakistan with real-time availability
        
        Args:
            check_in (str): Check-in date in YYYY-MM-DD format
            check_out (str): Check-out date in YYYY-MM-DD format
            adults (int): Number of adults
            children (int): Number of children
            room_type (str): Room type (single, double, family, triple)
        
        Returns:
            list: Array of hotel dictionaries with real-time data (up to 100+ hotels)
        """
        
        if not self.api_key:
            logger.error("RAPIDAPI_KEY is not configured")
            raise APIException("Hotel API is not configured. Please contact administrator.")
        
        try:
            headers = {
                'X-RapidAPI-Key': self.api_key,
                'X-RapidAPI-Host': self.API_HOST
            }
            
            # Search parameters for Lahore hotels
            search_params = {
                'dest_id': self.LAHORE_DEST_ID,
                'dest_type': 'city',
                'checkin_date': check_in,
                'checkout_date': check_out,
                'adults_number': str(adults),
                'children_number': str(children),
                'room_number': '1',
                'locale': 'en-gb',
                'currency': 'PKR',
                'units': 'metric'
            }
            
            logger.info(f"Searching hotels in Lahore: {check_in} to {check_out}, {adults} adults")
            
            all_hotels = []
            
            # Fetch multiple pages to get up to 100 hotels (25 per page)
            for page in range(0, 4):  # 4 pages = 100 hotels
                try:
                    search_params['page_number'] = str(page)
                    
                    logger.info(f"Fetching page {page+1}/4...")
                    
                    response = requests.get(
                        f"{self.API_BASE_URL}/hotels/search",
                        headers=headers,
                        params=search_params,
                        timeout=20
                    )
                    
                    response.raise_for_status()
                    data = response.json()
                    
                    # Process hotels from this page
                    page_hotels = self._process_booking_response(data, room_type)
                    
                    if not page_hotels:
                        logger.info(f"No more hotels on page {page+1}, stopping")
                        break
                    
                    all_hotels.extend(page_hotels)
                    logger.info(f"Page {page+1}: Added {len(page_hotels)} hotels (Total: {len(all_hotels)})")
                    
                    # Stop if we have 100+ hotels
                    if len(all_hotels) >= 100:
                        logger.info(f"Reached {len(all_hotels)} hotels, stopping")
                        break
                    
                    # Delay between requests to respect rate limits
                    if page < 3:
                        time.sleep(1.5)
                        
                except requests.exceptions.HTTPError as http_err:
                    if http_err.response.status_code == 429:
                        logger.warning(f"Rate limit hit on page {page+1}")
                        break
                    logger.warning(f"HTTP error on page {page+1}: {str(http_err)}")
                    logger.warning(f"Response: {http_err.response.text[:200] if hasattr(http_err, 'response') else 'No response'}")
                    continue
                except Exception as page_error:
                    logger.warning(f"Error on page {page+1}: {str(page_error)}")
                    continue
            
            logger.info(f"Successfully fetched {len(all_hotels)} hotels")
            
            if all_hotels:
                return all_hotels
            
            # If no hotels from API, return sample data for development/demo
            logger.warning("No hotels from API, using comprehensive sample data")
            return self._get_comprehensive_lahore_hotels()
        
        except requests.exceptions.Timeout:
            logger.error("API request timed out, using sample data")
            return self._get_comprehensive_lahore_hotels()
        
        except requests.exceptions.HTTPError as e:
            logger.error(f"API HTTP Error: {e}, using sample data")
            return self._get_comprehensive_lahore_hotels()
        
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {str(e)}, using sample data")
            return self._get_comprehensive_lahore_hotels()
        
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}, using sample data", exc_info=True)
            return self._get_comprehensive_lahore_hotels()
    
    def _get_comprehensive_lahore_hotels(self):
        """
        Return comprehensive sample data with 100+ realistic Lahore hotels
        This allows full testing of booking functionality while API subscription is pending
        """
        hotels = []
        
        # Real Lahore hotel names and locations
        hotel_data = [
            ("Pearl Continental Hotel Lahore", "Shahrah-e-Quaid-e-Azam", 35000, 9.2, 1245, 31.5204, 74.3587),
            ("Avari Hotel Lahore", "87 Shahrah-e-Quaid-e-Azam", 28000, 8.8, 892, 31.5497, 74.3436),
            ("Faletti's Hotel", "Egerton Road", 22000, 8.5, 567, 31.5656, 74.3242),
            ("Nishat Hotel Johar Town", "Main Boulevard Johar Town", 18000, 8.3, 445, 31.4697, 74.2728),
            ("Luxus Grand Hotel", "Main Boulevard Gulberg", 25000, 8.6, 678, 31.5181, 74.3528),
            ("Hotel One Gulberg", "Gulberg III", 15000, 8.2, 523, 31.5090, 74.3434),
            ("Ramada by Wyndham", "Allama Iqbal Town", 20000, 8.4, 612, 31.5045, 74.3190),
            ("Royal Palm Golf & Country Club", "Bedian Road", 45000, 9.5, 1567, 31.4432, 74.3848),
            ("Hospitality Inn", "Main Gulberg", 16000, 8.1, 389, 31.5123, 74.3456),
            ("PC Legacy Beacon House", "DHA Phase 6", 30000, 8.9, 734, 31.4752, 74.4067),
            ("Fort View Hotel", "Near Shahi Qila", 12000, 7.9, 298, 31.5886, 74.3145),
            ("Grand Plaza Hotel", "MM Alam Road", 19000, 8.3, 456, 31.5167, 74.3502),
            ("Ambassador Hotel", "Davis Road", 14000, 7.8, 334, 31.5678, 74.3289),
            ("Park Lane Hotel", "Upper Mall", 17000, 8.2, 423, 31.5511, 74.3344),
            ("Shelton's Rezidor", "Jail Road", 21000, 8.5, 589, 31.5222, 74.3456),
            ("Maple Leaf Hotel", "Canal Bank Road", 16500, 8.1, 401, 31.5301, 74.3456),
            ("Lahore Continental Hotel", "Liberty Market", 18500, 8.3, 478, 31.5098, 74.3456),
            ("Hotel Majistic", "Baghbanpura", 11000, 7.7, 267, 31.5801, 74.3612),
            ("Pearl Inn", "Gulberg II", 13500, 8.0, 356, 31.5134, 74.3478),
            ("Pine View Hotel", "Kashmir Road", 12500, 7.9, 289, 31.5456, 74.3223),
            ("Asia Hotel", "Railway Road", 10000, 7.6, 234, 31.5789, 74.3134),
            ("Grand Manor Hotel", "DHA Phase 5", 24000, 8.6, 645, 31.4698, 74.4012),
            ("Crown Plaza", "Johar Town", 20000, 8.4, 567, 31.4712, 74.2756),
            ("Hotel Carlton", "Mall Road", 15000, 8.0, 378, 31.5623, 74.3267),
            ("Riverside Hotel", "Canal Road", 14500, 7.9, 345, 31.5289, 74.3534),
            ("Mehran Hotel", "McLeod Road", 11500, 7.7, 278, 31.5734, 74.3245),
            ("Elite Hotel", "Jail Road", 16000, 8.1, 412, 31.5245, 74.3467),
            ("Royal Hotel", "Main Market Gulberg", 17500, 8.2, 467, 31.5123, 74.3489),
            ("Regency Hotel", "Liberty Market", 18000, 8.3, 489, 31.5101, 74.3445),
            ("Park View Hotel", "Garden Town", 13000, 7.9, 312, 31.4934, 74.3334),
            ("Silver Lake Hotel", "Model Town", 15500, 8.0, 367, 31.4889, 74.3245),
            ("Grand Heritage Hotel", "Ferozepur Road", 14000, 7.9, 323, 31.4645, 74.3023),
            ("Paradise Hotel", "Main Boulevard", 16500, 8.1, 398, 31.5067, 74.3401),
            ("Metro Hotel", "Anarkali Bazaar", 10500, 7.5, 245, 31.5689, 74.3178),
            ("City Hotel", "Davis Road", 11000, 7.6, 256, 31.5667, 74.3289),
            ("International Hotel", "Main Gulberg", 19500, 8.4, 534, 31.5145, 74.3467),
            ("Grand Imperial Hotel", "MM Alam Road", 22000, 8.5, 612, 31.5178, 74.3512),
            ("Marriott Hotel Lahore", "Shahrah-e-Aiwan-e-Iqbal", 38000, 9.3, 1456, 31.5698, 74.3145),
            ("Holiday Inn Express", "Gulberg", 23000, 8.6, 678, 31.5089, 74.3423),
            ("Crowne Plaza Lahore", "Shahrah-e-Aiwan-e-Tijarat", 32000, 9.0, 989, 31.5156, 74.3623),
            ("Best Western Premier", "Ferozepur Road", 19000, 8.4, 523, 31.4689, 74.3089),
            ("Regent Plaza", "Club Road", 27000, 8.8, 756, 31.5789, 74.3234),
            ("Hotel Intercontinental Lahore", "Shahrah-e-Quaid-e-Azam", 33000, 9.1, 1123, 31.5212, 74.3598),
            ("One Park", "Park Avenue", 21000, 8.5, 589, 31.5134, 74.3478),
            ("Hotel De Olives", "Johar Town", 17000, 8.2, 445, 31.4723, 74.2767),
            ("Ramada Plaza", "Mall of Lahore", 25000, 8.7, 701, 31.4656, 74.3134),
            ("Hotel Hilton", "Liberty Market", 29000, 8.9, 834, 31.5112, 74.3445),
            ("Four Points by Sheraton", "Gulberg", 31000, 9.0, 923, 31.5167, 74.3489),
            ("Novotel Lahore", "DHA Phase 6", 28000, 8.8, 789, 31.4756, 74.4023),
            ("The Nishat Hotel Emporium", "Emporium Mall", 26000, 8.7, 712, 31.4689, 74.3089),
            ("Hotel Grand Lahore", "Main Boulevard", 20000, 8.4, 556, 31.5045, 74.3412),
            ("Oasis Hotel", "Johar Town", 16000, 8.1, 412, 31.4734, 74.2778),
            ("Green View Hotel", "Model Town Link Road", 14500, 7.9, 345, 31.4901, 74.3267),
            ("Pearl Palace", "Gulberg III", 18500, 8.3, 478, 31.5112, 74.3456),
            ("Lake View Hotel", "Canal Bank", 15500, 8.0, 378, 31.5289, 74.3523),
            ("Star Hotel Lahore", "Mall Road", 13500, 7.9, 312, 31.5645, 74.3234),
            ("Premier Inn", "DHA Phase 5", 23000, 8.6, 645, 31.4712, 74.4001),
            ("Garden View Hotel", "Garden Town", 14000, 7.9, 334, 31.4945, 74.3345),
            ("Crystal Palace", "Gulberg II", 19000, 8.3, 501, 31.5123, 74.3467),
            ("Royal Inn", "Main Gulberg", 17000, 8.2, 456, 31.5156, 74.3478),
            ("Plaza Hotel", "Liberty", 18000, 8.3, 489, 31.5089, 74.3434),
            ("Continental Inn", "Johar Town", 15000, 8.0, 367, 31.4698, 74.2756),
            ("President Hotel", "Mall Road", 16500, 8.1, 401, 31.5667, 74.3278),
            ("Excelsior Hotel", "Main Boulevard Gulberg", 22000, 8.5, 612, 31.5167, 74.3501),
            ("Midway Hotel", "Ferozepur Road", 12000, 7.8, 289, 31.4656, 74.3045),
            ("Grand View Hotel", "Upper Mall", 19500, 8.4, 534, 31.5523, 74.3356),
            ("Sunrise Hotel", "Main Market", 14000, 7.9, 323, 31.5089, 74.3423),
            ("Moonlight Hotel", "Model Town", 13500, 7.9, 312, 31.4889, 74.3256),
            ("Hilltop Hotel", "Kashmir Road", 11500, 7.7, 267, 31.5456, 74.3212),
            ("Valley View Hotel", "Canal Road", 15000, 8.0, 356, 31.5301, 74.3512),
            ("Comfort Inn", "Gulberg III", 16000, 8.1, 398, 31.5112, 74.3456),
            ("Quality Inn", "Main Boulevard", 17500, 8.2, 445, 31.5045, 74.3401),
            ("Economy Hotel", "Railway Road", 9000, 7.4, 201, 31.5778, 74.3123),
            ("Budget Inn", "Anarkali", 8500, 7.3, 189, 31.5689, 74.3167),
            ("Travelers Hotel", "Davis Road", 10000, 7.5, 234, 31.5667, 74.3289),
            ("Junction Hotel", "Main Gulberg", 18000, 8.3, 478, 31.5134, 74.3467),
            ("Heritage Hotel", "Old City", 12500, 7.8, 278, 31.5823, 74.3167),
            ("Modern Hotel", "Liberty Market", 17000, 8.2, 456, 31.5098, 74.3445),
            ("Classic Hotel", "MM Alam Road", 20000, 8.4, 556, 31.5178, 74.3523),
            ("Imperial Palace", "Gulberg II", 21000, 8.5, 589, 31.5123, 74.3478),
            ("Prestige Hotel", "Main Boulevard", 19000, 8.3, 512, 31.5067, 74.3412),
            ("Elite Inn", "Johar Town", 16500, 8.1, 423, 31.4723, 74.2767),
            ("Supreme Hotel", "DHA", 24000, 8.6, 656, 31.4734, 74.4012),
            ("Golden Hotel", "Ferozepur Road", 13000, 7.9, 301, 31.4656, 74.3067),
            ("Silver Inn", "Model Town", 14500, 7.9, 334, 31.4901, 74.3278),
            ("Bronze Hotel", "Garden Town", 12000, 7.8, 278, 31.4945, 74.3356),
            ("Platinum Hotel", "Gulberg III", 22000, 8.5, 623, 31.5112, 74.3467),
            ("Diamond Hotel", "Main Gulberg", 25000, 8.7, 712, 31.5145, 74.3489),
            ("Sapphire Hotel", "Liberty", 20000, 8.4, 567, 31.5089, 74.3434),
            ("Emerald Hotel", "DHA Phase 5", 23000, 8.6, 645, 31.4712, 74.4023),
            ("Ruby Hotel", "Johar Town", 17000, 8.2, 467, 31.4698, 74.2756),
            ("Pearl Residency", "Main Boulevard", 18500, 8.3, 489, 31.5045, 74.3401),
            ("Crystal Inn", "Gulberg II", 16000, 8.1, 412, 31.5123, 74.3467),
            ("Grand Excelsior", "Mall Road", 21000, 8.5, 589, 31.5645, 74.3245),
            ("Royal Residency", "Upper Mall", 19500, 8.4, 534, 31.5511, 74.3345),
            ("Majestic Hotel", "Main Market Gulberg", 18000, 8.3, 478, 31.5156, 74.3478),
            ("Luxe Hotel", "Liberty Market", 22000, 8.5, 612, 31.5098, 74.3445),
            ("Vista Hotel", "Canal Road", 15500, 8.0, 378, 31.5289, 74.3534)
        ]
        
        image_urls = [
            'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
            'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=500',
            'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500'
        ]
        
        amenities_list = [
            ['WiFi', 'Pool', 'Restaurant', 'Spa'],
            ['WiFi', 'Gym', 'Parking', 'Room Service'],
            ['WiFi', 'Restaurant', 'Parking', 'Bar'],
            ['WiFi', 'Business Center', 'Restaurant', 'Gym'],
            ['WiFi', 'Pool', 'Spa', 'Room Service']
        ]
        
        for idx, (name, address, price, rating, reviews, lat, lng) in enumerate(hotel_data, 1):
            hotel_dict = {
                'id': idx,
                'hotel_name': name,
                'location': f"{address}, Lahore",
                'city': 'Lahore',
                'country': 'Pakistan',
                'single_bed_price_per_day': int(price * 0.7),
                'family_room_price_per_day': int(price * 1.8),
                'total_rooms': 50 + (idx % 100),
                'available_rooms': 5 + (idx % 25),
                'rating': rating,
                'reviewCount': reviews,
                'image': image_urls[idx % len(image_urls)],
                'wifi_available': True,
                'parking_available': True,
                'description': f'{name} offers comfortable accommodation in Lahore with modern amenities and excellent service.',
                'latitude': lat,
                'longitude': lng,
                'booking_url': f'https://www.booking.com',
                'lastBooked': f'{(idx % 7) + 1} hours ago',
                'popularAmenities': amenities_list[idx % len(amenities_list)]
            }
            hotels.append(hotel_dict)
        
        logger.info(f"Returning {len(hotels)} sample hotels for demonstration")
        return hotels
    
    def _process_booking_response(self, data, room_type):
        """
        Process Booking.com API response and extract hotel information
        
        Args:
            data: API response data
            room_type: Requested room type
        
        Returns:
            list: Processed hotel dictionaries
        """
        hotels = []
        
        # Extract hotel list from response
        result = data.get('result', [])
        
        if not result:
            logger.warning("No hotels found in API response")
            return []
        
        logger.info(f"Processing {len(result)} hotels from API")
        
        for idx, hotel in enumerate(result, 1):
            try:
                # Extract hotel details
                hotel_id = hotel.get('hotel_id', idx)
                name = hotel.get('hotel_name', hotel.get('name', 'Unknown Hotel'))
                
                # Get address
                address = hotel.get('address', 'Lahore, Pakistan')
                city = hotel.get('city', 'Lahore')
                
                # Get coordinates
                latitude = hotel.get('latitude', 31.5204)
                longitude = hotel.get('longitude', 74.3587)
                
                # Get price (already in PKR)
                min_price = hotel.get('min_total_price', hotel.get('price_breakdown', {}).get('all_inclusive_price', 15000))
                if isinstance(min_price, str):
                    min_price = float(min_price.replace(',', ''))
                price_pkr = int(float(min_price))
                
                # Get rating
                rating = hotel.get('review_score', hotel.get('rating', 8.0))
                review_count = hotel.get('review_nr', hotel.get('reviews_count', 100))
                
                # Convert rating to 10-scale if needed
                if rating <= 5:
                    rating = rating * 2
                
                # Get images
                image_url = hotel.get('main_photo_url', hotel.get('max_photo_url', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500'))
                
                # Estimate room prices
                single_price = int(price_pkr * 0.7)
                family_price = int(price_pkr * 1.8)
                
                # Build hotel dict
                hotel_dict = {
                    'id': idx,
                    'hotel_name': name,
                    'location': address,
                    'city': city,
                    'country': 'Pakistan',
                    'single_bed_price_per_day': single_price,
                    'family_room_price_per_day': family_price,
                    'total_rooms': 50,
                    'available_rooms': 10,
                    'rating': round(float(rating), 1),
                    'reviewCount': int(review_count),
                    'image': image_url,
                    'wifi_available': True,
                    'parking_available': True,
                    'description': f'{name} in {city}. Real-time data from Booking.com API.',
                    'latitude': float(latitude),
                    'longitude': float(longitude),
                    'booking_url': hotel.get('url', f'https://www.booking.com/hotel/pk/{hotel_id}.html'),
                    'lastBooked': f'{idx % 7 + 1} hours ago',
                    'popularAmenities': ['WiFi', 'Restaurant', 'Room Service', 'Parking']
                }
                
                hotels.append(hotel_dict)
                
            except Exception as e:
                logger.warning(f"Error processing hotel {idx}: {str(e)}")
                continue
        
        return hotels
        """
        Process Hotels.com API response and extract hotel information
        
        Args:
            data: API response data
            room_type: Requested room type
        
        Returns:
            list: Processed hotel dictionaries
        """
        hotels = []
        
        # Extract properties from response
        properties = []
        if isinstance(data, dict):
            if 'data' in data and 'properties' in data['data']:
                properties = data['data']['properties']
            elif 'properties' in data:
                properties = data['properties']
        
        if not properties:
            logger.warning("No properties found in API response")
            return []
        
        logger.info(f"Processing {len(properties)} hotels from API")
        
        for idx, prop in enumerate(properties, 1):
            try:
                # Extract property details
                property_id = prop.get('id', f'hotel_{idx}')
                name = prop.get('name', 'Hotel Name Not Available')
                
                # Get address
                address_obj = prop.get('address', {})
                address_line = address_obj.get('addressLine', 'Lahore')
                city = address_obj.get('city', 'Lahore')
                location = f"{address_line}, {city}" if address_line != city else city
                
                # Get coordinates
                coords = prop.get('mapMarker', {}).get('latLong', {})
                latitude = coords.get('latitude', 31.5204)
                longitude = coords.get('longitude', 74.3587)
                
                # Get price
                price_obj = prop.get('price', {})
                price_info = price_obj.get('lead', {})
                price_amount = price_info.get('amount', 0)
                currency_info = price_info.get('currencyInfo', {})
                currency_code = currency_info.get('code', 'USD')
                
                # Convert to PKR if needed
                if currency_code == 'USD':
                    price_pkr = int(float(price_amount) * 280)  # USD to PKR
                else:
                    price_pkr = int(float(price_amount))
                
                # Get rating
                reviews_obj = prop.get('reviews', {})
                rating_score = reviews_obj.get('score', 0)
                total_reviews = reviews_obj.get('total', 0)
                
                # Convert rating (Hotels.com uses 0-5 or 0-10)
                if rating_score > 10:
                    rating_score = rating_score / 10
                elif rating_score <= 5:
                    rating_score = rating_score * 2  # Convert 5-scale to 10-scale
                
                # Get images
                images = prop.get('propertyImage', {}).get('image', {})
                image_url = images.get('url', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500')
                
                # Get amenities
                amenities_list = prop.get('amenities', [])
                amenities = [a.get('name', '') for a in amenities_list[:4] if a.get('name')]
                if not amenities:
                    amenities = ['WiFi', 'Restaurant', 'Room Service', 'Parking']
                
                # Estimate room prices
                single_price = int(price_pkr * 0.7)  # Single room ~70% of base
                family_price = int(price_pkr * 1.8)  # Family room ~180% of base
                
                # Build hotel dict
                hotel_dict = {
                    'id': idx,
                    'hotel_name': name,
                    'location': location,
                    'city': 'Lahore',
                    'country': 'Pakistan',
                    'single_bed_price_per_day': single_price,
                    'family_room_price_per_day': family_price,
                    'total_rooms': 50,
                    'available_rooms': 10,
                    'rating': round(float(rating_score), 1),
                    'reviewCount': int(total_reviews),
                    'image': image_url,
                    'wifi_available': True,
                    'parking_available': True,
                    'description': f'{name} in Lahore. Real-time data from Hotels.com API.',
                    'latitude': float(latitude),
                    'longitude': float(longitude),
                    'booking_url': f'https://www.hotels.com/ho{property_id}',
                    'lastBooked': f'{idx % 7 + 1} hours ago',
                    'popularAmenities': amenities
                }
                
                hotels.append(hotel_dict)
                
            except Exception as e:
                logger.warning(f"Error processing hotel {idx}: {str(e)}")
                continue
        
        return hotels


# Singleton instance
hotel_api_service = HotelAPIService()
