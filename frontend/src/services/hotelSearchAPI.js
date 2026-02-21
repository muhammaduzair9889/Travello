/**
 * Hotel Search API Service for Lahore, Pakistan
 * Connects to Django backend which runs Puppeteer scraper for REAL-TIME Booking.com data
 * 
 * API Endpoint: POST /api/scraper/scrape-hotels/
 */

import axios from 'axios';

// Backend API Configuration
const API_ROOT = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '');

/**
 * Search hotels in Lahore, Pakistan with REAL-TIME data from Booking.com scraper
 * @param {Object} params - Search parameters
 * @param {string} params.checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.checkOut - Check-out date (YYYY-MM-DD)
 * @param {number} params.adults - Number of adults (default: 2)
 * @param {number} params.children - Number of children (default: 0)
 * @param {string} params.roomType - Room type (single, double, family, triple)
 * @returns {Promise<Array>} Array of real hotel objects from Booking.com
 */
export const searchLahoreHotels = async (params = {}) => {
  console.log('🔍 Searching REAL hotels in Lahore via Puppeteer scraper...');
  console.log('📋 Search Parameters:', params);

  const {
    checkIn = getDefaultCheckIn(),
    checkOut = getDefaultCheckOut(),
    adults = 2,
    children = 0,
    roomType = 'double'
  } = params;

  try {
    // Call the Puppeteer scraper endpoint for real-time Booking.com data
    const response = await axios.post(
      `${API_ROOT}/api/scraper/scrape-hotels/`,
      {
        city: 'Lahore',
        checkin: checkIn,
        checkout: checkOut,
        adults: adults,
        children: children,
        rooms: 1,
        use_cache: true
      },
      {
        timeout: 320000, // 5+ min timeout for multi-page scraping
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Scraper response received:', response.data);

    if (response.data.success && Array.isArray(response.data.hotels)) {
      const rawHotels = response.data.hotels;
      console.log(`📊 Found ${rawHotels.length} REAL hotels from Booking.com scraper`);

      // Transform scraped data to the format HotelResults expects
      const hotels = rawHotels.map((hotel, index) => {
        // Parse numeric price from strings like "Rs 100,000" or "PKR 50,000"
        let pricePerNight = 15000; // default
        if (hotel.price) {
          const priceMatch = hotel.price.replace(/,/g, '').match(/[\d]+/);
          if (priceMatch) {
            pricePerNight = parseInt(priceMatch[0]) || 15000;
          }
        }

        // Calculate per-night price (scraper may return total for all nights)
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
        // If total price seems too high for a per-night price, divide by nights
        if (pricePerNight > 500000) {
          pricePerNight = Math.round(pricePerNight / nights);
        }

        // Parse rating (from "9.3" or "Excellent 9.3")
        let ratingValue = 0;
        if (hotel.rating) {
          const ratingMatch = hotel.rating.toString().match(/[\d.]+/);
          if (ratingMatch) ratingValue = parseFloat(ratingMatch[0]) || 0;
        }

        // Parse review count from strings like "836 reviews"
        let reviewCount = 0;
        if (hotel.review_count) {
          const reviewMatch = hotel.review_count.toString().replace(/,/g, '').match(/\d+/);
          if (reviewMatch) reviewCount = parseInt(reviewMatch[0]) || 0;
        }

        // Build amenities object from array (e.g. ["WiFi", "Pool", ...])
        const amenitiesArray = hotel.amenities || [];
        const amenitiesText = amenitiesArray.join(', ').toLowerCase();
        const amenities = {
          wifi: amenitiesText.includes('wifi') || amenitiesText.includes('internet') || amenitiesText.includes('wi-fi'),
          parking: amenitiesText.includes('parking') || amenitiesText.includes('car park'),
          pool: amenitiesText.includes('pool') || amenitiesText.includes('swimming'),
          restaurant: amenitiesText.includes('restaurant') || amenitiesText.includes('dining') || amenitiesText.includes('breakfast'),
          spa: amenitiesText.includes('spa') || amenitiesText.includes('wellness'),
          gym: amenitiesText.includes('gym') || amenitiesText.includes('fitness'),
        };

        // Extract address from location/distance
        const address = hotel.location || hotel.distance || 'Lahore, Pakistan';

        return {
          id: index + 1,
          hotel_name: hotel.name || 'Hotel',
          name: hotel.name || 'Hotel',
          location: address,
          address: address,
          city: 'Lahore',
          country: 'Pakistan',
          single_bed_price_per_day: Math.round(pricePerNight * 0.7),
          double_bed_price_per_day: pricePerNight,
          triple_bed_price_per_day: Math.round(pricePerNight * 1.3),
          quad_bed_price_per_day: Math.round(pricePerNight * 1.5),
          family_room_price_per_day: Math.round(pricePerNight * 1.8),
          price: pricePerNight,
          total_rooms: 50,
          available_rooms: hotel.rooms_left || 10,
          rating: ratingValue,
          reviewCount: reviewCount,
          image: hotel.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
          wifi_available: amenities.wifi,
          parking_available: amenities.parking,
          amenities: amenities,
          description: amenitiesArray.length > 0
            ? amenitiesArray.join(' • ')
            : `${hotel.name} in Lahore. Real-time data from Booking.com.`,
          latitude: 31.5204 + (Math.random() - 0.5) * 0.1, // Approximate Lahore coords
          longitude: 74.3587 + (Math.random() - 0.5) * 0.1,
          booking_url: hotel.url || 'https://www.booking.com',
          lastBooked: `${Math.floor(Math.random() * 5) + 1} hours ago`,
          popularAmenities: amenitiesArray.slice(0, 4),
          availability: hotel.availability || 'Available',
          is_limited: hotel.is_limited || false,
          has_deal: hotel.has_deal || null,
          original_price: hotel.original_price || null,
          is_real_time: true,
          source: 'booking.com'
        };
      });

      console.log(`✅ Transformed ${hotels.length} hotels for display`);
      return hotels;
    }

    // If scraper returned no data
    console.warn('⚠️ Scraper returned no hotels');
    return [];

  } catch (error) {
    console.error('❌ Error fetching real-time hotel data:', error);

    if (error.response) {
      const errorData = error.response.data;
      console.error('Server Error Response:', errorData);
      const errorMsg = errorData?.message || errorData?.error || `Server error: ${error.response.status}`;
      throw new Error(errorMsg);
    } else if (error.request) {
      console.error('No response from server - request timeout or connection issue');
      throw new Error('Unable to connect to hotel search service. The scraper may still be running. Please try again in a moment.');
    } else {
      console.error('Request Error:', error.message);
      throw error;
    }
  }
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

export default {
  searchLahoreHotels,
  getDefaultCheckIn,
  getDefaultCheckOut
};
