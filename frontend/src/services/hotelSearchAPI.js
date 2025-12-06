/**
 * Hotel Search API Service for Lahore, Pakistan
 * Connects to Django backend which fetches REAL-TIME data from Booking.com RapidAPI
 * 
 * API Endpoint: POST /api/hotels/search-live/
 */

import axios from 'axios';

// Backend API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

/**
 * Search hotels in Lahore, Pakistan with REAL-TIME data
 * @param {Object} params - Search parameters
 * @param {string} params.checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.checkOut - Check-out date (YYYY-MM-DD)
 * @param {number} params.adults - Number of adults (default: 2)
 * @param {number} params.children - Number of children (default: 0)
 * @param {number} params.infants - Number of infants (default: 0)
 * @param {string} params.roomType - Room type (single, double, family, triple)
 * @returns {Promise<Array>} Array of real hotel objects from Booking.com
 */
export const searchLahoreHotels = async (params = {}) => {
  console.log('🔍 Searching REAL hotels in Lahore, Pakistan...');
  console.log('📋 Search Parameters:', params);

  const {
    checkIn = getDefaultCheckIn(),
    checkOut = getDefaultCheckOut(),
    adults = 2,
    children = 0,
    infants = 0,
    roomType = 'double'
  } = params;

  try {
    // Call Django backend API which fetches real-time data
    const response = await axios.post(
      `${API_BASE_URL}/hotels/search-live/`,
      {
        check_in: checkIn,
        check_out: checkOut,
        adults: adults,
        children: children,
        infants: infants,
        room_type: roomType
      },
      {
        timeout: 20000, // 20 second timeout for API call
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ API Response received:', response.data);
    console.log('📋 Response structure:', {
      success: response.data.success,
      count: response.data.count,
      hotels: response.data.hotels ? response.data.hotels.length : 'N/A',
      hasHotelsArray: Array.isArray(response.data.hotels)
    });

    // Check if response indicates failure
    if (response.data.success === false) {
      const errorMsg = response.data.message || response.data.error || 'Hotel search failed';
      console.error('❌ API returned error:', errorMsg);
      console.error('❌ Full error response:', response.data);
      throw new Error(errorMsg);
    }

    // Check if hotels array exists (even if empty)
    if (response.data.success !== false && Array.isArray(response.data.hotels)) {
      const hotels = response.data.hotels;
      console.log(`📊 Found ${hotels.length} REAL hotels in Lahore from Booking.com`);
      
      if (hotels.length > 0) {
        console.log('🏨 First hotel sample:', hotels[0]);
      }
      
      // Return hotels array (even if empty)
      return hotels;
    } else {
      console.warn('⚠️ Unexpected API response format:', response.data);
      console.warn('⚠️ Response keys:', Object.keys(response.data));
      
      // Try to extract hotels from different possible locations
      if (response.data.hotels && Array.isArray(response.data.hotels)) {
        console.log('✅ Found hotels in response.data.hotels');
        return response.data.hotels;
      }
      
      // Return empty array as fallback
      console.warn('⚠️ No hotels found in response, returning empty array');
      return [];
    }

  } catch (error) {
    console.error('❌ Error fetching real-time hotel data:', error);

    if (error.response) {
      // Server responded with error status code
      const errorData = error.response.data;
      console.error('Server Error Response:', errorData);
      
      // Extract error message from various possible formats
      const errorMsg = errorData?.message || 
                      errorData?.error || 
                      errorData?.details || 
                      `Server error: ${error.response.status}`;
      
      throw new Error(errorMsg);
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server - request timeout or connection issue');
      throw new Error('Unable to connect to hotel search service. Please check your internet connection and ensure the backend server is running.');
    } else {
      // Error in request setup or other error
      console.error('Request Error:', error.message);
      throw error; // Re-throw the error with its original message
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
