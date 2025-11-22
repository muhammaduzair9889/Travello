import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaWifi, FaParking, FaStar, FaSearch, FaMapMarkerAlt } from 'react-icons/fa';
import { hotelAPI } from '../services/api';

const HotelsList = () => {
  const navigate = useNavigate();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHotels();
  }, []);

  // Memoized filtered hotels - only recomputes when dependencies change
  const filteredHotels = useMemo(() => {
    if (!searchQuery) return hotels;
    
    const query = searchQuery.toLowerCase();
    return hotels.filter(
      (hotel) =>
        hotel.hotel_name?.toLowerCase().includes(query) ||
        hotel.location?.toLowerCase().includes(query) ||
        hotel.city?.toLowerCase().includes(query)
    );
  }, [searchQuery, hotels]);

  const fetchHotels = async () => {
    try {
      const response = await hotelAPI.getAllHotels();
      setHotels(response.data);
    } catch (error) {
      console.error('Error fetching hotels:', error);
      alert('Failed to load hotels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookRoom = useCallback((hotel, roomType) => {
    navigate('/hotel-booking', { state: { hotel, roomType } });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading hotels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">
            Browse Hotels
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Find and book your perfect stay
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400 text-sm sm:text-base" />
            </div>
            <input
              type="text"
              className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm sm:text-base"
              placeholder="Search by hotel name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Hotels Grid */}
        {filteredHotels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No hotels found. Try a different search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHotels.map((hotel) => (
              <motion.div
                key={hotel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
              >
                {/* Hotel Image */}
                <div className="h-48 bg-gradient-to-r from-sky-400 to-blue-500 relative overflow-hidden">
                  {hotel.image ? (
                    <img
                      src={hotel.image}
                      alt={hotel.hotel_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                      {hotel.hotel_name.charAt(0)}
                    </div>
                  )}
                  {/* Rating Badge */}
                  <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 px-3 py-1 rounded-full flex items-center gap-1">
                    <FaStar className="text-yellow-500" />
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {hotel.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Hotel Details */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    {hotel.hotel_name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
                    <FaMapMarkerAlt className="text-sky-600" />
                    <span className="text-sm">{hotel.location}</span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {hotel.description}
                  </p>

                  {/* Amenities */}
                  <div className="flex gap-3 mb-4">
                    {hotel.wifi_available && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <FaWifi className="text-sky-600" />
                        <span>WiFi</span>
                      </div>
                    )}
                    {hotel.parking_available && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <FaParking className="text-sky-600" />
                        <span>Parking</span>
                      </div>
                    )}
                  </div>

                  {/* Availability */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Available Rooms: <span className="font-semibold text-gray-800 dark:text-white">{hotel.available_rooms}</span> / {hotel.total_rooms}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Single Room</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        PKR {hotel.single_bed_price_per_day.toLocaleString('en-PK')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">per day</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Family Room</p>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        PKR {hotel.family_room_price_per_day.toLocaleString('en-PK')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">per day</p>
                    </div>
                  </div>

                  {/* Booking Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleBookRoom(hotel, 'single')}
                      disabled={hotel.available_rooms === 0}
                      className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Book Single
                    </button>
                    <button
                      onClick={() => handleBookRoom(hotel, 'family')}
                      disabled={hotel.available_rooms === 0}
                      className="py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Book Family
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotelsList;