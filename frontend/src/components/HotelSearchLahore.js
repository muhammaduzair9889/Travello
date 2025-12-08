import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaWifi, FaParking, FaStar, FaMapMarkerAlt, FaUsers, FaChild, FaBaby, FaBed, FaCalendar, FaExternalLinkAlt, FaFilter } from 'react-icons/fa';
import { searchLahoreHotels } from '../services/hotelSearchAPI';

/**
 * Hotel Search Component for Lahore, Pakistan
 * Integrates with Booking.com RapidAPI
 */
const HotelSearchLahore = () => {
  // Search form state
  const [searchParams, setSearchParams] = useState({
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0,
    infants: 0,
    roomType: 'double'
  });

  // Results state
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Handle search button click
   */
  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      console.log('🔍 Searching hotels with params:', searchParams);
      
      const results = await searchLahoreHotels({
        checkIn: searchParams.checkIn,
        checkOut: searchParams.checkOut,
        adults: parseInt(searchParams.adults),
        children: parseInt(searchParams.children),
        roomType: searchParams.roomType
      });

      console.log('📊 Search results:', results);
      
      // Debug: Check first hotel's price fields
      if (results.length > 0) {
        console.log('🔍 First hotel price fields:', {
          single: results[0].single_bed_price_per_day,
          double: results[0].double_bed_price_per_day,
          triple: results[0].triple_bed_price_per_day,
          quad: results[0].quad_bed_price_per_day,
          family: results[0].family_room_price_per_day
        });
      }
      
      setHotels(results);
      
      if (results.length === 0) {
        setError('No hotels found. Please try again.');
      }

    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search hotels. Please try again.');
      setHotels([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format price in PKR
   */
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(price);
  };

  /**
   * Handle room booking
   */
  const handleBooking = (hotel, roomType, price) => {
    // Store booking info and navigate to booking page
    const bookingData = {
      hotelId: hotel.id,
      hotelName: hotel.name,
      location: hotel.address,
      roomType: roomType,
      pricePerNight: price,
      checkIn: searchParams.checkIn,
      checkOut: searchParams.checkOut,
      adults: searchParams.adults,
      children: searchParams.children
    };
    
    console.log('📝 Booking:', bookingData);
    
    // Store in localStorage for booking page
    localStorage.setItem('bookingData', JSON.stringify(bookingData));
    
    // Navigate to booking page (you can customize this route)
    window.location.href = '/hotel-booking';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Find Hotels in Lahore
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Search from thousands of hotels in Lahore, Pakistan
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
            <FaSearch className="text-sky-600" />
            Search Hotels by City
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            
            {/* Destination (Fixed to Lahore) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Destination
              </label>
              <div className="relative">
                <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value="Lahore, Pakistan"
                  disabled
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white cursor-not-allowed"
                />
              </div>
            </div>

            {/* Check-in Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-in Date
              </label>
              <div className="relative">
                <FaCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="checkIn"
                  value={searchParams.checkIn}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Check-out Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-out Date
              </label>
              <div className="relative">
                <FaCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="checkOut"
                  value={searchParams.checkOut}
                  onChange={handleInputChange}
                  min={searchParams.checkIn || new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Adults */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adults
              </label>
              <div className="relative">
                <FaUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  name="adults"
                  value={searchParams.adults}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <option key={num} value={num}>{num} Adult{num > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Children */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Children
              </label>
              <div className="relative">
                <FaChild className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  name="children"
                  value={searchParams.children}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                  {[0, 1, 2, 3, 4].map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'Child' : 'Children'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Infants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Infants
              </label>
              <div className="relative">
                <FaBaby className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  name="infants"
                  value={searchParams.infants}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                  {[0, 1, 2].map(num => (
                    <option key={num} value={num}>{num} Infant{num !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Room Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Room Type
            </label>
            <div className="flex flex-wrap gap-3">
              {['single', 'double', 'triple', 'quad', 'family'].map(type => (
                <button
                  key={type}
                  onClick={() => setSearchParams(prev => ({ ...prev, roomType: type }))}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    searchParams.roomType === type
                      ? 'bg-sky-600 text-white shadow-lg'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <FaBed className="inline mr-2" />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Searching Hotels...
              </>
            ) : (
              <>
                <FaSearch />
                Search Hotels
              </>
            )}
          </button>

          {/* View Advanced Results Button */}
          {searched && hotels.length > 0 && (
            <button
              onClick={() => {
                const params = new URLSearchParams({
                  checkIn: searchParams.checkIn,
                  checkOut: searchParams.checkOut,
                  adults: searchParams.adults,
                  children: searchParams.children,
                  roomType: searchParams.roomType
                });
                window.location.href = `/hotels/results?${params.toString()}`;
              }}
              className="w-full mt-3 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <FaFilter />
              View Advanced Results (Sorting, Filters & Map)
            </button>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400"
            >
              {error}
            </motion.div>
          )}
        </motion.div>

        {/* Results Section */}
        <AnimatePresence>
          {searched && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-4 text-gray-700 dark:text-gray-300">
                <p className="text-lg font-semibold">
                  {hotels.length > 0 ? `Found ${hotels.length} hotels in Lahore` : 'No hotels found'}
                </p>
              </div>

              {/* Hotel Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hotels.map((hotel, index) => (
                  <motion.div
                    key={hotel.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-shadow"
                  >
                    {/* Hotel Image */}
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={hotel.image}
                        alt={hotel.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/400x300?text=Hotel+Image';
                        }}
                      />
                      {hotel.rating > 0 && (
                        <div className="absolute top-3 right-3 bg-yellow-500 text-white px-3 py-1 rounded-full flex items-center gap-1 font-bold shadow-lg">
                          <FaStar />
                          {hotel.rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {/* Hotel Details */}
                    <div className="p-5">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 line-clamp-2">
                        {hotel.name}
                      </h3>

                      <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 mb-3">
                        <FaMapMarkerAlt className="mt-1 flex-shrink-0" />
                        <p className="text-sm line-clamp-2">{hotel.address}</p>
                      </div>

                      {/* Amenities */}
                      <div className="flex gap-3 mb-4">
                        {hotel.amenities?.wifi && (
                          <div className="flex items-center gap-1 text-sky-600" title="WiFi Available">
                            <FaWifi />
                          </div>
                        )}
                        {hotel.amenities?.parking && (
                          <div className="flex items-center gap-1 text-sky-600" title="Parking Available">
                            <FaParking />
                          </div>
                        )}
                      </div>

                      {/* Room Type Booking Options */}
                      <div className="space-y-3 mb-4">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Choose Room Type:</p>
                        
                        {/* Double Room */}
                        {hotel.double_bed_price_per_day && hotel.double_bed_price_per_day > 0 && (
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-white">Double Room</p>
                              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {formatPrice(hotel.double_bed_price_per_day)}/night
                              </p>
                            </div>
                            <button
                              onClick={() => handleBooking(hotel, 'double', hotel.double_bed_price_per_day)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                              Book Now
                            </button>
                          </div>
                        )}

                        {/* Triple Room */}
                        {hotel.triple_bed_price_per_day && hotel.triple_bed_price_per_day > 0 && (
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-700">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-white">Triple Room</p>
                              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                {formatPrice(hotel.triple_bed_price_per_day)}/night
                              </p>
                            </div>
                            <button
                              onClick={() => handleBooking(hotel, 'triple', hotel.triple_bed_price_per_day)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                            >
                              Book Now
                            </button>
                          </div>
                        )}

                        {/* Quad Room */}
                        {hotel.quad_bed_price_per_day && hotel.quad_bed_price_per_day > 0 && (
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-700">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-white">Quad Room</p>
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                {formatPrice(hotel.quad_bed_price_per_day)}/night
                              </p>
                            </div>
                            <button
                              onClick={() => handleBooking(hotel, 'quad', hotel.quad_bed_price_per_day)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                              Book Now
                            </button>
                          </div>
                        )}

                        {/* Family Room */}
                        {hotel.family_room_price_per_day && hotel.family_room_price_per_day > 0 && (
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg border border-orange-200 dark:border-orange-700">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-white">Family Room</p>
                              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                {formatPrice(hotel.family_room_price_per_day)}/night
                              </p>
                            </div>
                            <button
                              onClick={() => handleBooking(hotel, 'family', hotel.family_room_price_per_day)}
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                            >
                              Book Now
                            </button>
                          </div>
                        )}
                      </div>

                      {/* View Details Button */}
                      <a
                        href={hotel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        View on Booking.com
                        <FaExternalLinkAlt />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HotelSearchLahore;
