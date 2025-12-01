/**
 * Hotel Search API Service for Lahore, Pakistan
 * Uses Booking.com RapidAPI (Free Tier)
 * 
 * API Documentation: https://rapidapi.com/DataCrawler/api/booking-com15
 * Free Tier: 500 requests/month
 */

import axios from 'axios';

// RapidAPI Configuration
const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = process.env.REACT_APP_RAPIDAPI_HOST || 'booking-com15.p.rapidapi.com';

// Lahore, Pakistan destination ID (from Booking.com)
const LAHORE_DEST_ID = '-2187133'; // Booking.com destination ID for Lahore
const LAHORE_DEST_TYPE = 'city';

/**
 * Search hotels in Lahore, Pakistan
 * @param {Object} params - Search parameters
 * @param {string} params.checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.checkOut - Check-out date (YYYY-MM-DD)
 * @param {number} params.adults - Number of adults (default: 2)
 * @param {number} params.children - Number of children (default: 0)
 * @param {string} params.roomType - Room type filter
 * @returns {Promise<Array>} Array of hotel objects
 */
export const searchLahoreHotels = async (params = {}) => {
  // For now, always return sample data since it's reliable and comprehensive
  // To use live API: Add your RapidAPI key to .env file and uncomment the API code below
  console.log('🔍 Searching hotels in Lahore, Pakistan...');
  console.log('Using curated Lahore hotel data');
  return getSampleLahoreHotels();

  /* UNCOMMENT THIS SECTION WHEN YOU HAVE A RAPIDAPI KEY
  
  // Check if API key is configured
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === '') {
    console.warn('⚠️ No RapidAPI key configured. Using sample data for demo.');
    return getSampleLahoreHotels();
  }

  try {
    const {
      checkIn = getDefaultCheckIn(),
      checkOut = getDefaultCheckOut(),
      adults = 2,
      children = 0,
      roomType = 'double'
    } = params;

    console.log('🔍 Searching hotels in Lahore, Pakistan...');
    console.log('Search params:', { checkIn, checkOut, adults, children, roomType });
    console.log('API Key configured:', RAPIDAPI_KEY ? 'Yes' : 'No');

    const options = {
      method: 'GET',
      url: `https://${RAPIDAPI_HOST}/api/v1/hotels/searchHotels`,
      params: {
        dest_id: LAHORE_DEST_ID,
        dest_type: LAHORE_DEST_TYPE,
        arrival_date: checkIn,
        departure_date: checkOut,
        adults: adults.toString(),
        children_number: children.toString(),
        room_number: '1',
        units: 'metric',
        temperature_unit: 'c',
        languagecode: 'en-us',
        currency_code: 'PKR'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      },
      timeout: 10000 // 10 second timeout
    };

    const response = await axios.request(options);
    
    console.log('✅ API Response received:', response.data);

    // Parse and format hotel data
    const hotels = parseHotelData(response.data);
    
    console.log(`📊 Found ${hotels.length} hotels in Lahore`);
    
    // If no hotels from API, return sample data
    if (hotels.length === 0) {
      console.warn('⚠️ No hotels from API, using sample data');
      return getSampleLahoreHotels();
    }
    
    return hotels;

  } catch (error) {
    console.error('❌ Error fetching hotels from API:', error);
    
    // Return sample data as fallback
    console.log('📋 Using sample hotel data as fallback');
    return getSampleLahoreHotels();
  }
  */
};

/**
 * Parse and format hotel data from API response
 * @param {Object} data - Raw API response data
 * @returns {Array} Formatted hotel array
 */
const parseHotelData = (data) => {
  if (!data || !data.data || !data.data.hotels) {
    console.warn('⚠️ No hotel data in API response');
    return [];
  }

  const hotels = data.data.hotels;

  return hotels.map(hotel => ({
    id: hotel.hotel_id || hotel.id,
    name: hotel.property?.name || hotel.hotel_name || 'Hotel Name Not Available',
    address: hotel.property?.address || hotel.address || 'Address not available',
    city: 'Lahore',
    country: 'Pakistan',
    price: extractPrice(hotel),
    rating: hotel.property?.reviewScore || hotel.review_score || 0,
    reviewCount: hotel.property?.reviewCount || hotel.review_count || 0,
    image: extractImage(hotel),
    amenities: extractAmenities(hotel),
    description: hotel.property?.description || hotel.description || '',
    latitude: hotel.property?.latitude || hotel.latitude,
    longitude: hotel.property?.longitude || hotel.longitude,
    url: hotel.url || `https://www.booking.com/hotel/pk/${hotel.hotel_id}.html`
  }));
};

/**
 * Extract price from hotel data
 * @param {Object} hotel - Hotel object from API
 * @returns {number} Price in PKR
 */
const extractPrice = (hotel) => {
  // Try different price fields
  if (hotel.composite_price_breakdown?.gross_amount?.value) {
    return parseFloat(hotel.composite_price_breakdown.gross_amount.value);
  }
  if (hotel.min_total_price) {
    return parseFloat(hotel.min_total_price);
  }
  if (hotel.price_breakdown?.gross_price) {
    return parseFloat(hotel.price_breakdown.gross_price);
  }
  return 0;
};

/**
 * Extract main image from hotel data
 * @param {Object} hotel - Hotel object from API
 * @returns {string} Image URL
 */
const extractImage = (hotel) => {
  // Try different image fields
  if (hotel.property?.photoUrls && hotel.property.photoUrls.length > 0) {
    return hotel.property.photoUrls[0];
  }
  if (hotel.main_photo_url) {
    return hotel.main_photo_url;
  }
  if (hotel.max_photo_url) {
    return hotel.max_photo_url;
  }
  // Fallback placeholder
  return 'https://via.placeholder.com/400x300?text=Hotel+Image';
};

/**
 * Extract amenities from hotel data
 * @param {Object} hotel - Hotel object from API
 * @returns {Object} Amenities object
 */
const extractAmenities = (hotel) => {
  const facilities = hotel.property?.facilities || hotel.facilities || [];
  
  return {
    wifi: facilities.some(f => f.toLowerCase().includes('wifi') || f.toLowerCase().includes('internet')),
    parking: facilities.some(f => f.toLowerCase().includes('parking')),
    pool: facilities.some(f => f.toLowerCase().includes('pool')),
    restaurant: facilities.some(f => f.toLowerCase().includes('restaurant')),
    gym: facilities.some(f => f.toLowerCase().includes('gym') || f.toLowerCase().includes('fitness'))
  };
};

/**
 * Get default check-in date (tomorrow)
 * @returns {string} Date in YYYY-MM-DD format
 */
const getDefaultCheckIn = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
};

/**
 * Get default check-out date (day after tomorrow)
 * @returns {string} Date in YYYY-MM-DD format
 */
const getDefaultCheckOut = () => {
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  return formatDate(dayAfter);
};

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get sample hotel data for Lahore, Pakistan
 * Used as fallback when API is unavailable or not configured
 * @returns {Array} Sample hotel array
 */
const getSampleLahoreHotels = () => {
  return [
    {
      id: 'hotel-1',
      hotel_name: 'Pearl Continental Hotel Lahore',
      location: 'Shahrah-e-Quaid-e-Azam, Mall Road',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 25000,
      family_room_price_per_day: 45000,
      total_rooms: 200,
      available_rooms: 45,
      rating: 8.5,
      reviewCount: 1250,
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Luxury 5-star hotel located on Mall Road with premium facilities, rooftop restaurant, and spa',
      latitude: 31.5656,
      longitude: 74.3189,
      lastBooked: '2 hours ago',
      popularAmenities: ['Swimming Pool', 'Spa', 'Gym', 'Restaurant']
    },
    {
      id: 'hotel-2',
      hotel_name: 'Avari Hotel Lahore',
      location: '87 Shahrah-e-Quaid-e-Azam',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 18000,
      family_room_price_per_day: 32000,
      total_rooms: 150,
      available_rooms: 38,
      rating: 8.2,
      reviewCount: 890,
      image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Elegant hotel with modern amenities in the heart of Lahore, featuring elegant dining and conference facilities',
      latitude: 31.5497,
      longitude: 74.3436,
      lastBooked: '5 hours ago',
      popularAmenities: ['Business Center', 'Restaurant', 'WiFi', 'Pool']
    },
    {
      id: 'hotel-3',
      hotel_name: 'Nishat Hotel Johar Town',
      location: 'Main Boulevard Johar Town',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 12000,
      family_room_price_per_day: 22000,
      total_rooms: 100,
      available_rooms: 28,
      rating: 7.8,
      reviewCount: 650,
      image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Modern hotel in Johar Town with excellent service, close to shopping areas and restaurants',
      latitude: 31.4697,
      longitude: 74.2728
    },
    {
      id: 'hotel-4',
      hotel_name: 'Luxus Grand Hotel',
      location: 'Main Boulevard Gulberg',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 15000,
      family_room_price_per_day: 27000,
      total_rooms: 120,
      available_rooms: 32,
      rating: 8.0,
      reviewCount: 720,
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Premium hotel in Gulberg with rooftop restaurant, gym, and business center',
      latitude: 31.5204,
      longitude: 74.3587
    },
    {
      id: 'hotel-5',
      hotel_name: 'Faletti\'s Hotel',
      location: 'Egerton Road',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 20000,
      family_room_price_per_day: 38000,
      total_rooms: 80,
      available_rooms: 22,
      rating: 8.3,
      reviewCount: 980,
      image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Historic luxury hotel established in 1880, featuring colonial architecture and heritage dining',
      latitude: 31.5497,
      longitude: 74.3436
    },
    {
      id: 'hotel-6',
      hotel_name: 'Hotel One Gulberg',
      location: 'Liberty Market, Gulberg III',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 8000,
      family_room_price_per_day: 14000,
      total_rooms: 60,
      available_rooms: 18,
      rating: 7.5,
      reviewCount: 540,
      image: 'https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Budget-friendly hotel near Liberty Market, perfect for shopping and sightseeing',
      latitude: 31.5088,
      longitude: 74.3428
    },
    {
      id: 'hotel-7',
      hotel_name: 'Ramada by Wyndham Lahore',
      location: 'Mall Road Cantt',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 16000,
      family_room_price_per_day: 29000,
      total_rooms: 110,
      available_rooms: 25,
      rating: 7.9,
      reviewCount: 810,
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'International chain hotel with modern facilities, pool, and fitness center',
      latitude: 31.5625,
      longitude: 74.3195
    },
    {
      id: 'hotel-8',
      hotel_name: 'Best Western Lahore',
      location: 'Main Boulevard DHA Phase 6',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 14000,
      family_room_price_per_day: 25000,
      total_rooms: 90,
      available_rooms: 30,
      rating: 7.7,
      reviewCount: 620,
      image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Comfortable hotel in DHA with great service, close to restaurants and entertainment',
      latitude: 31.4698,
      longitude: 74.3911
    },
    {
      id: 'hotel-9',
      hotel_name: 'Hospitality Inn',
      location: 'Jail Road',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 10000,
      family_room_price_per_day: 18000,
      total_rooms: 70,
      available_rooms: 20,
      rating: 7.4,
      reviewCount: 450,
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Affordable hotel near major shopping areas with clean rooms and friendly staff',
      latitude: 31.5088,
      longitude: 74.3428
    },
    {
      id: 'hotel-10',
      hotel_name: 'Regent Plaza Hotel',
      location: 'Shahrah-e-Quaid-e-Azam',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 22000,
      family_room_price_per_day: 40000,
      total_rooms: 180,
      available_rooms: 42,
      rating: 8.4,
      reviewCount: 1100,
      image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: '5-star hotel with executive facilities, spa, and multiple dining options',
      latitude: 31.5590,
      longitude: 74.3180,
      lastBooked: '1 hour ago',
      popularAmenities: ['Executive Lounge', 'Spa', 'Pool', 'Fine Dining']
    },
    {
      id: 'hotel-11',
      hotel_name: 'Marriott Hotel Lahore',
      location: 'MM Alam Road, Gulberg III',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 28000,
      family_room_price_per_day: 50000,
      total_rooms: 220,
      available_rooms: 55,
      rating: 8.8,
      reviewCount: 1580,
      image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'International 5-star hotel with world-class amenities, rooftop pool, and award-winning restaurants',
      latitude: 31.5203,
      longitude: 74.3535,
      lastBooked: '30 minutes ago',
      popularAmenities: ['Rooftop Pool', 'Multi-Cuisine Restaurant', 'Spa', 'Concierge']
    },
    {
      id: 'hotel-12',
      hotel_name: 'Hilton Garden Inn Lahore',
      location: 'Liberty Market Road, Gulberg',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 17000,
      family_room_price_per_day: 30000,
      total_rooms: 160,
      available_rooms: 48,
      rating: 8.1,
      reviewCount: 920,
      image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Contemporary hotel near Liberty Market with modern rooms and excellent service',
      latitude: 31.5088,
      longitude: 74.3450,
      lastBooked: '3 hours ago',
      popularAmenities: ['Garden View', 'Fitness Center', 'Restaurant', 'Free WiFi']
    },
    {
      id: 'hotel-13',
      hotel_name: 'Royal Palm Golf & Country Club',
      location: 'Main Ferozpur Road',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 35000,
      family_room_price_per_day: 65000,
      total_rooms: 100,
      available_rooms: 18,
      rating: 9.0,
      reviewCount: 780,
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Exclusive luxury resort with golf course, multiple pools, and premium villas',
      latitude: 31.4529,
      longitude: 74.2702,
      lastBooked: '45 minutes ago',
      popularAmenities: ['Golf Course', '3 Pools', 'Tennis Courts', 'Fine Dining']
    },
    {
      id: 'hotel-14',
      hotel_name: 'Park Plaza Lahore',
      location: 'Main Boulevard DHA Phase 5',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 19000,
      family_room_price_per_day: 34000,
      total_rooms: 140,
      available_rooms: 35,
      rating: 8.3,
      reviewCount: 1050,
      image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Modern hotel in DHA with spacious rooms, rooftop restaurant, and event facilities',
      latitude: 31.4687,
      longitude: 74.3832,
      lastBooked: '4 hours ago',
      popularAmenities: ['Rooftop Dining', 'Event Halls', 'Gym', 'Free Parking']
    },
    {
      id: 'hotel-15',
      hotel_name: 'Shahi Qila Hotel & Resort',
      location: 'Near Walled City',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 9500,
      family_room_price_per_day: 17000,
      total_rooms: 80,
      available_rooms: 22,
      rating: 7.6,
      reviewCount: 580,
      image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Heritage-style hotel near Lahore Fort with traditional Mughal architecture and local cuisine',
      latitude: 31.5888,
      longitude: 74.3153,
      lastBooked: '6 hours ago',
      popularAmenities: ['Heritage Tours', 'Local Cuisine', 'Cultural Events', 'City View']
    },
    {
      id: 'hotel-16',
      hotel_name: 'The Nishat Continental',
      location: 'Canal Road',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 16500,
      family_room_price_per_day: 29000,
      total_rooms: 130,
      available_rooms: 40,
      rating: 8.0,
      reviewCount: 870,
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Premium hotel along Canal Road with lake views, multiple restaurants, and conference facilities',
      latitude: 31.5165,
      longitude: 74.3405,
      lastBooked: '2 hours ago',
      popularAmenities: ['Lake View', 'Conference Rooms', '3 Restaurants', 'Pool']
    },
    {
      id: 'hotel-17',
      hotel_name: 'Crown Plaza Lahore',
      location: 'Shahrah-e-Faisal',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 21000,
      family_room_price_per_day: 38000,
      total_rooms: 170,
      available_rooms: 38,
      rating: 8.5,
      reviewCount: 1230,
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'International chain hotel with business facilities, spa, and fine dining options',
      latitude: 31.5630,
      longitude: 74.3231,
      lastBooked: '1 hour ago',
      popularAmenities: ['Business Center', 'Spa & Wellness', 'Fine Dining', 'Club Lounge']
    },
    {
      id: 'hotel-18',
      hotel_name: 'The Residency Hotel',
      location: 'Jail Road, Near UET',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 11000,
      family_room_price_per_day: 19500,
      total_rooms: 95,
      available_rooms: 28,
      rating: 7.7,
      reviewCount: 640,
      image: 'https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Comfortable mid-range hotel near universities and hospitals, ideal for families',
      latitude: 31.5788,
      longitude: 74.3250,
      lastBooked: '7 hours ago',
      popularAmenities: ['Family Friendly', 'Near Universities', 'Restaurant', 'Free WiFi']
    },
    {
      id: 'hotel-19',
      hotel_name: 'The Luxe Manor Lahore',
      location: 'Main Boulevard Phase 8, DHA',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 23000,
      family_room_price_per_day: 42000,
      total_rooms: 110,
      available_rooms: 26,
      rating: 8.6,
      reviewCount: 950,
      image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Boutique luxury hotel with personalized service, gourmet restaurant, and elegant suites',
      latitude: 31.4615,
      longitude: 74.4102,
      lastBooked: '3 hours ago',
      popularAmenities: ['Boutique Suites', 'Gourmet Dining', 'Personal Butler', 'Spa']
    },
    {
      id: 'hotel-20',
      hotel_name: 'Fortaleza Hotel',
      location: 'Main Market Gulberg',
      city: 'Lahore',
      country: 'Pakistan',
      single_bed_price_per_day: 13500,
      family_room_price_per_day: 24000,
      total_rooms: 85,
      available_rooms: 20,
      rating: 7.9,
      reviewCount: 710,
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
      wifi_available: true,
      parking_available: true,
      description: 'Centrally located hotel in Gulberg with shopping access and rooftop cafe',
      latitude: 31.5126,
      longitude: 74.3515,
      lastBooked: '5 hours ago',
      popularAmenities: ['Shopping Access', 'Rooftop Cafe', 'City Center', 'Free Parking']
    }
  ];
};

export default {
  searchLahoreHotels,
  getDefaultCheckIn,
  getDefaultCheckOut
};
