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
    
    # Hotels.com API Configuration (RapidAPI)
    API_BASE_URL = 'https://hotels-com-provider.p.rapidapi.com/v2'
    API_HOST = 'hotels-com-provider.p.rapidapi.com'
    
    # Lahore coordinates
    LAHORE_LATITUDE = 31.5204
    LAHORE_LONGITUDE = 74.3587
    
    def __init__(self):
        self.api_key = getattr(settings, 'RAPIDAPI_KEY', None)
        if not self.api_key:
            logger.warning("RAPIDAPI_KEY not configured in settings")    def _get_access_token(self):
        """
        Get OAuth2 access token from Amadeus API
        """
        if not self.api_key or not self.api_secret:
            raise APIException("Amadeus API credentials not configured")
        
        try:
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            data = {
                'grant_type': 'client_credentials',
                'client_id': self.api_key,
                'client_secret': self.api_secret
            }
            
            logger.info(f"Requesting Amadeus token with API Key: {self.api_key[:10]}...")
            
            response = requests.post(self.TOKEN_URL, headers=headers, data=data, timeout=10)
            
            logger.info(f"Amadeus token response status: {response.status_code}")
            logger.info(f"Amadeus token response: {response.text[:200]}")
            
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data['access_token']
            logger.info("Successfully obtained Amadeus access token")
            
            return self.access_token
            
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP Error getting Amadeus token: {e}")
            logger.error(f"Response: {e.response.text if hasattr(e, 'response') else 'No response'}")
            raise APIException(f"Authentication failed: Invalid API credentials. Please verify your Amadeus API Key and Secret at https://developers.amadeus.com/my-apps")
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get Amadeus access token: {str(e)}")
            raise APIException("Failed to authenticate with hotel API")
    
    def search_lahore_hotels(self, check_in, check_out, adults=2, children=0, room_type='double'):
        """
        Search for hotels in Lahore, Pakistan with real-time availability using Amadeus API
        
        Args:
            check_in (str): Check-in date in YYYY-MM-DD format
            check_out (str): Check-out date in YYYY-MM-DD format
            adults (int): Number of adults
            children (int): Number of children
            room_type (str): Room type (single, double, family, triple)
        
        Returns:
            list: Array of hotel dictionaries with real-time data (up to 100+ hotels)
        """
        
        if not self.api_key or not self.api_secret:
            logger.error("Amadeus API credentials not configured")
            raise APIException("Hotel API is not configured. Please contact administrator.")
        
        try:
            # Get access token
            if not self.access_token:
                self._get_access_token()
            
            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }
            
            params = {
                'latitude': self.LAHORE_LATITUDE,
                'longitude': self.LAHORE_LONGITUDE,
                'radius': 50,  # 50km radius from city center
                'radiusUnit': 'KM',
                'hotelSource': 'ALL'
            }
            
            logger.info(f"Searching hotels in Lahore: {check_in} to {check_out}, {adults} adults")
            
            # Step 1: Search for hotels by location
            response = requests.get(
                f"{self.API_BASE_URL}/reference-data/locations/hotels/by-geocode",
                headers=headers,
                params=params,
                timeout=15
            )
            
            response.raise_for_status()
            hotel_data = response.json()
            
            if 'data' not in hotel_data or not hotel_data['data']:
                logger.warning("No hotels found in Lahore")
                return []
            
            hotels_list = hotel_data['data']
            logger.info(f"Found {len(hotels_list)} hotels in Lahore")
            
            # Step 2: Get hotel offers with prices for check-in/out dates
            # Take first 100 hotels to get detailed pricing
            hotel_ids = [hotel['hotelId'] for hotel in hotels_list[:100]]
            
            # Process hotels in batches to get pricing
            all_hotels = []
            batch_size = 20  # Process 20 hotels at a time
            
            for i in range(0, min(len(hotel_ids), 100), batch_size):
                batch_ids = hotel_ids[i:i+batch_size]
                
                offer_params = {
                    'hotelIds': ','.join(batch_ids),
                    'checkInDate': check_in,
                    'checkOutDate': check_out,
                    'adults': adults,
                    'roomQuantity': 1,
                    'currency': 'PKR'
                }
                
                try:
                    logger.info(f"Fetching offers for batch {i//batch_size + 1} ({len(batch_ids)} hotels)...")
                    
                    offers_response = requests.get(
                        f"{self.API_BASE_URL}/shopping/hotel-offers",
                        headers=headers,
                        params=offer_params,
                        timeout=15
                    )
                    
                    offers_response.raise_for_status()
                    offers_data = offers_response.json()
                    
                    if 'data' in offers_data and offers_data['data']:
                        batch_hotels = self._process_amadeus_response(offers_data['data'], hotels_list)
                        all_hotels.extend(batch_hotels)
                        logger.info(f"Batch {i//batch_size + 1}: Added {len(batch_hotels)} hotels (Total: {len(all_hotels)})")
                    
                    # Small delay between batches
                    if i + batch_size < min(len(hotel_ids), 100):
                        time.sleep(0.5)
                        
                except requests.exceptions.HTTPError as http_err:
                    if http_err.response.status_code == 401:
                        # Token expired, refresh and retry
                        logger.warning("Access token expired, refreshing...")
                        self._get_access_token()
                        headers['Authorization'] = f'Bearer {self.access_token}'
                        continue
                    logger.warning(f"Error fetching offers batch {i//batch_size + 1}: {str(http_err)}")
                    continue
                except Exception as batch_error:
                    logger.warning(f"Error processing batch {i//batch_size + 1}: {str(batch_error)}")
                    continue
            
            logger.info(f"Successfully fetched {len(all_hotels)} hotels with pricing")
            
            if all_hotels:
                return all_hotels
            
            logger.warning("No hotels with pricing available")
            return []
        
        except requests.exceptions.Timeout:
            logger.error("API request timed out")
            raise APIException("Hotel search timed out. Please try again.")
        
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                logger.warning("Rate limit exceeded, returning sample hotels")
                return self._get_sample_lahore_hotels()
            logger.error(f"API HTTP Error: {e}")
            logger.error(f"Response content: {e.response.text if hasattr(e, 'response') else 'No response'}")
            raise APIException(f"Failed to fetch hotel data: {str(e)}")
        
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {str(e)}")
            raise APIException(f"Failed to fetch hotel data: {str(e)}")
        
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            raise APIException(f"An unexpected error occurred: {str(e)}")
    
    def _process_amadeus_response(self, offers_data, hotels_list):
        """
        Process Amadeus API response and extract hotel information
        
        Args:
            offers_data: Hotel offers data from Amadeus API
            hotels_list: Original hotel list with basic info
        
        Returns:
            list: Processed hotel dictionaries
        """
        hotels = []
        
        # Create a lookup dict for hotel details
        hotel_details_map = {h['hotelId']: h for h in hotels_list}
        
        for idx, offer in enumerate(offers_data, 1):
            try:
                hotel_id = offer.get('hotel', {}).get('hotelId')
                hotel_info = hotel_details_map.get(hotel_id, {})
                
                # Get hotel name
                hotel_name = offer.get('hotel', {}).get('name', 'Unknown Hotel')
                
                # Get address
                address_obj = hotel_info.get('address', {})
                city_name = address_obj.get('cityName', 'Lahore')
                address = address_obj.get('lines', [''])[0] if 'lines' in address_obj else f"{city_name}, Pakistan"
                
                # Get coordinates
                geo = hotel_info.get('geoCode', {})
                latitude = geo.get('latitude', self.LAHORE_LATITUDE)
                longitude = geo.get('longitude', self.LAHORE_LONGITUDE)
                
                # Get pricing from first available offer
                offers_list = offer.get('offers', [])
                if not offers_list:
                    continue
                
                first_offer = offers_list[0]
                price_obj = first_offer.get('price', {})
                total_price = float(price_obj.get('total', 0))
                
                # If price in USD, convert to PKR
                currency = price_obj.get('currency', 'PKR')
                if currency == 'USD':
                    total_price = total_price * 280  # USD to PKR conversion
                
                # Calculate per-day price
                room_obj = first_offer.get('room', {})
                room_type_code = room_obj.get('typeEstimated', {}).get('category', 'STANDARD')
                beds = room_obj.get('typeEstimated', {}).get('beds', 2)
                
                # Estimate single and family room prices
                single_bed_price = int(total_price * 0.7)  # Single room ~70% of double
                family_room_price = int(total_price * 1.8)  # Family room ~180% of double
                
                # Get rating and reviews (Amadeus doesn't provide these, use defaults)
                rating = 8.0  # Default rating
                review_count = 150  # Default review count
                
                # Available rooms
                available = first_offer.get('policies', {}).get('guarantee', {}).get('acceptedPayments', {})
                available_rooms = 10  # Default availability
                
                # Amenities
                amenities = ['WiFi', 'Room Service', 'Air Conditioning']
                
                hotel_dict = {
                    'id': idx,
                    'hotel_name': hotel_name,
                    'location': address,
                    'city': city_name,
                    'country': 'Pakistan',
                    'single_bed_price_per_day': single_bed_price,
                    'family_room_price_per_day': family_room_price,
                    'total_rooms': 50,  # Default
                    'available_rooms': available_rooms,
                    'rating': rating,
                    'reviewCount': review_count,
                    'image': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',  # Default image
                    'wifi_available': True,
                    'parking_available': True,
                    'description': f'{hotel_name} in {city_name}. Real-time data from Amadeus API.',
                    'latitude': latitude,
                    'longitude': longitude,
                    'booking_url': f'https://www.amadeus.com',
                    'lastBooked': f'{idx} hours ago',
                    'popularAmenities': amenities
                }
                
                hotels.append(hotel_dict)
                
            except Exception as e:
                logger.warning(f"Error processing hotel offer: {str(e)}")
                continue
        
        return hotels
        """Return sample Lahore hotels when API is rate limited"""
        return [
            {
                'id': 1,
                'hotel_name': 'Pearl Continental Hotel Lahore (Sample - API Rate Limited)',
                'location': 'Shahrah-e-Quaid-e-Azam, Lahore',
                'city': 'Lahore',
                'country': 'Pakistan',
                'single_bed_price_per_day': 35000,
                'family_room_price_per_day': 63000,
                'total_rooms': 100,
                'available_rooms': 25,
                'rating': 9.2,
                'reviewCount': 1245,
                'image': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
                'wifi_available': True,
                'parking_available': True,
                'description': 'Luxury 5-star hotel in the heart of Lahore. NOTE: This is sample data shown because API rate limit was exceeded. Real-time data will appear once rate limit resets.',
                'latitude': 31.5204,
                'longitude': 74.3587,
                'booking_url': 'https://www.booking.com',
                'lastBooked': '2 hours ago',
                'popularAmenities': ['WiFi', 'Pool', 'Restaurant', 'Spa', 'Gym', 'Parking']
            },
            {
                'id': 2,
                'hotel_name': 'Avari Hotel Lahore (Sample - API Rate Limited)',
                'location': '87 Shahrah-e-Quaid-e-Azam, Lahore',
                'city': 'Lahore',
                'country': 'Pakistan',
                'single_bed_price_per_day': 28000,
                'family_room_price_per_day': 50400,
                'total_rooms': 80,
                'available_rooms': 18,
                'rating': 8.8,
                'reviewCount': 892,
                'image': 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=500',
                'wifi_available': True,
                'parking_available': True,
                'description': 'Elegant hotel with modern amenities. NOTE: Sample data - API rate limited.',
                'latitude': 31.5497,
                'longitude': 74.3436,
                'booking_url': 'https://www.booking.com',
                'lastBooked': '4 hours ago',
                'popularAmenities': ['WiFi', 'Restaurant', 'Room Service', 'Parking']
            },
            {
                'id': 3,
                'hotel_name': 'Faletti\'s Hotel (Sample - API Rate Limited)',
                'location': 'Egerton Road, Lahore',
                'city': 'Lahore',
                'country': 'Pakistan',
                'single_bed_price_per_day': 22000,
                'family_room_price_per_day': 39600,
                'total_rooms': 60,
                'available_rooms': 15,
                'rating': 8.5,
                'reviewCount': 567,
                'image': 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500',
                'wifi_available': True,
                'parking_available': True,
                'description': 'Historic hotel with colonial charm. NOTE: Sample data - API rate limited.',
                'latitude': 31.5656,
                'longitude': 74.3242,
                'booking_url': 'https://www.booking.com',
                'lastBooked': '1 hour ago',
                'popularAmenities': ['WiFi', 'Restaurant', 'Parking', 'Bar']
            }
        ]
        """
        Process and transform API response to frontend format
        
        Args:
            data (dict): Raw API response
            room_type (str): Requested room type
        
        Returns:
            list: Formatted hotel data
        """
        hotels = []
        
        # Log the full response for debugging
        logger.info(f"Processing API response. Data type: {type(data)}")
        logger.info(f"Response preview: {str(data)[:500]}")
        
        # Try different response structures
        raw_hotels = None
        
        # Structure 1: data.data.hotels
        if isinstance(data, dict) and 'data' in data:
            if isinstance(data['data'], dict) and 'hotels' in data['data']:
                raw_hotels = data['data']['hotels']
                logger.info(f"Found hotels in data.data.hotels: {len(raw_hotels)} hotels")
            elif isinstance(data['data'], list):
                raw_hotels = data['data']
                logger.info(f"Found hotels in data.data (list): {len(raw_hotels)} hotels")
        
        # Structure 2: data.result
        if not raw_hotels and isinstance(data, dict) and 'result' in data:
            raw_hotels = data['result']
            logger.info(f"Found hotels in data.result: {len(raw_hotels)} hotels")
        
        # Structure 3: direct list
        if not raw_hotels and isinstance(data, list):
            raw_hotels = data
            logger.info(f"Found hotels as direct list: {len(raw_hotels)} hotels")
        
        # Structure 4: data.hotels
        if not raw_hotels and isinstance(data, dict) and 'hotels' in data:
            raw_hotels = data['hotels']
            logger.info(f"Found hotels in data.hotels: {len(raw_hotels)} hotels")
        
        if not raw_hotels:
            logger.warning(f"No hotels found in API response. Response keys: {data.keys() if isinstance(data, dict) else 'N/A'}")
            return []
        
        for hotel in raw_hotels:
            try:
                # Extract property object if it exists
                property_data = hotel.get('property', {})
                
                # Extract hotel name from multiple possible locations
                hotel_name = (
                    property_data.get('name') or 
                    hotel.get('hotel_name') or 
                    hotel.get('name') or 
                    'Hotel Name Not Available'
                )
                
                # Extract address/location
                location = (
                    property_data.get('address') or
                    hotel.get('address') or 
                    hotel.get('location') or 
                    'Lahore, Pakistan'
                )
                
                processed_hotel = {
                    'id': hotel.get('hotel_id', property_data.get('id', hotel.get('id', ''))),
                    'hotel_name': hotel_name,
                    'location': location,
                    'city': 'Lahore',
                    'country': 'Pakistan',
                    'single_bed_price_per_day': self._extract_price(hotel, property_data),
                    'family_room_price_per_day': int(self._extract_price(hotel, property_data) * 1.8),
                    'total_rooms': hotel.get('total_rooms', 100),
                    'available_rooms': hotel.get('available_rooms', self._estimate_availability(hotel)),
                    'rating': self._extract_rating(hotel, property_data),
                    'reviewCount': property_data.get('reviewCount', property_data.get('review_count', hotel.get('review_count', hotel.get('review_nr', hotel.get('reviewCount', 0))))),
                    'image': self._extract_image(hotel, property_data),
                    'wifi_available': self._has_amenity(hotel, 'wifi'),
                    'parking_available': self._has_amenity(hotel, 'parking'),
                    'description': hotel.get('property_description', property_data.get('hotel_description', hotel.get('description', f'{hotel_name} - Comfortable accommodation in Lahore'))),
                    'latitude': property_data.get('latitude', hotel.get('latitude', 31.5204)),
                    'longitude': property_data.get('longitude', hotel.get('longitude', 74.3587)),
                    'booking_url': hotel.get('url', f"https://www.booking.com/hotel/pk/{hotel.get('hotel_id', property_data.get('id', ''))}.html"),
                    'lastBooked': self._generate_last_booked(),
                    'popularAmenities': self._extract_amenities(hotel)
                }
                
                hotels.append(processed_hotel)
            
            except Exception as e:
                logger.warning(f"Failed to process hotel: {str(e)}")
                continue
        
        logger.info(f"Successfully processed {len(hotels)} hotels")
        return hotels
    
    def _extract_price(self, hotel, property_data=None):
        """Extract price from various possible API fields"""
        if property_data is None:
            property_data = hotel.get('property', {})
            
        # Try different price fields
        price_usd = 0
        
        # Try property.priceBreakdown.grossPrice
        if 'priceBreakdown' in property_data:
            price_breakdown = property_data['priceBreakdown']
            if 'grossPrice' in price_breakdown:
                gross_price = price_breakdown['grossPrice']
                if isinstance(gross_price, dict) and 'value' in gross_price:
                    price_usd = float(gross_price['value'])
        
        # Try other locations
        if price_usd == 0 and 'composite_price_breakdown' in hotel:
            price_data = hotel['composite_price_breakdown']
            if 'gross_amount' in price_data:
                price_usd = float(price_data['gross_amount'].get('value', 0))
        
        if price_usd == 0 and 'min_total_price' in hotel:
            price_usd = float(hotel['min_total_price'])
        
        if price_usd == 0 and 'price_breakdown' in hotel:
            price_breakdown = hotel['price_breakdown']
            if isinstance(price_breakdown, dict) and 'gross_price' in price_breakdown:
                gross_price = price_breakdown['gross_price']
                if isinstance(gross_price, dict) and 'value' in gross_price:
                    price_usd = float(gross_price['value'])
                else:
                    price_usd = float(gross_price)
        
        # Default price if nothing found
        if price_usd == 0:
            price_usd = 50  # Default $50
        
        # Convert USD to PKR (approximate rate: 1 USD = 280 PKR)
        price_pkr = int(price_usd * 280)
        
        return price_pkr
    
    def _extract_rating(self, hotel, property_data=None):
        """Extract rating from API response"""
        if property_data is None:
            property_data = hotel.get('property', {})
            
        # Try property.reviewScore first
        rating = property_data.get('reviewScore', property_data.get('review_score', 0))
        
        # Fallback to hotel level
        if rating == 0:
            rating = hotel.get('review_score', hotel.get('review_score_word', 0))
        
        if isinstance(rating, str):
            # Convert word ratings to numbers
            rating_map = {
                'exceptional': 9.5,
                'wonderful': 9.0,
                'very good': 8.5,
                'good': 8.0,
                'pleasant': 7.5,
                'okay': 7.0
            }
            rating = rating_map.get(rating.lower(), 8.0)
        
        try:
            rating = float(rating)
            # Booking.com uses 0-10 scale
            if rating > 10:
                rating = rating / 10
            return round(rating, 1)
        except:
            return 8.0
    
    def _extract_image(self, hotel, property_data=None):
        """Extract main image URL"""
        if property_data is None:
            property_data = hotel.get('property', {})
            
        # Try property.photoUrls first
        if 'photoUrls' in property_data and property_data['photoUrls']:
            return property_data['photoUrls'][0]
        
        # Try different image fields
        if 'max_photo_url' in hotel:
            return hotel['max_photo_url']
        
        if 'main_photo_url' in hotel:
            return hotel['main_photo_url']
        
        if 'property' in hotel and 'photoUrls' in hotel['property']:
            photos = hotel['property']['photoUrls']
            if photos and len(photos) > 0:
                return photos[0]
        
        # Default placeholder
        return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80'
    
    def _has_amenity(self, hotel, amenity_type):
        """Check if hotel has specific amenity"""
        facilities = hotel.get('facilities', [])
        
        if not facilities:
            facilities = hotel.get('property', {}).get('facilities', [])
        
        # Check in facilities list
        for facility in facilities:
            facility_name = facility.lower() if isinstance(facility, str) else str(facility).lower()
            
            if amenity_type == 'wifi':
                if 'wifi' in facility_name or 'internet' in facility_name or 'wi-fi' in facility_name:
                    return True
            
            elif amenity_type == 'parking':
                if 'parking' in facility_name or 'car park' in facility_name:
                    return True
        
        # Default to True for better UX (most hotels have these)


# Singleton instance
hotel_api_service = HotelAPIService()
