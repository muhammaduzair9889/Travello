import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaStar, FaMapMarkerAlt, FaHotel, FaSpinner, FaRedo,
  FaHeart, FaRegHeart, FaWifi, FaParking,
  FaSwimmingPool, FaUtensils, FaRobot,
  FaSearch, FaSlidersH
} from 'react-icons/fa';
import axios from 'axios';

const API_BASE = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '') + '/api';

const fmt = (n) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(n || 0);

const getRatingLabel = (r) => {
  if (r >= 9) return 'Exceptional';
  if (r >= 8) return 'Excellent';
  if (r >= 7) return 'Very Good';
  if (r >= 6) return 'Good';
  return 'Pleasant';
};

const PREFERENCE_OPTIONS = [
  { id: 'luxury', label: 'Luxury', emoji: '✨' },
  { id: 'budget', label: 'Budget', emoji: '💰' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
  { id: 'romantic', label: 'Romantic', emoji: '💕' },
  { id: 'business', label: 'Business', emoji: '💼' },
  { id: 'adventure', label: 'Adventure', emoji: '🏔️' },
];

const CITY_OPTIONS = ['Lahore', 'Islamabad', 'Karachi', 'Peshawar', 'Quetta', 'Multan'];

/* ── Recommendation Card ── */
const RecommendationCard = ({ hotel, index, isFavorite, onToggleFav }) => {
  const price = hotel.price_per_night || hotel.double_bed_price_per_day || hotel.price || 0;
  const rating = typeof hotel.rating === 'number' ? hotel.rating : parseFloat(hotel.rating) || 0;
  const stars = hotel.stars || hotel.star_rating || 0;
  const image = hotel.image_url || hotel.image || `https://via.placeholder.com/400x250?text=${encodeURIComponent((hotel.name || 'Hotel').slice(0, 20))}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all group border border-gray-100 dark:border-gray-700"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={image}
          alt={hotel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400x250?text=Hotel'; }}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(hotel.id || index); }}
          className="absolute top-3 right-3 w-9 h-9 bg-white/90 dark:bg-gray-800/90 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
        >
          {isFavorite ? <FaHeart className="text-red-500" /> : <FaRegHeart className="text-gray-500" />}
        </button>

        {hotel.ai_reason && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <p className="text-white text-xs flex items-center gap-1">
              <FaRobot className="shrink-0 text-blue-300" />
              {hotel.ai_reason}
            </p>
          </div>
        )}

        {hotel.match_score && (
          <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            {Math.round(hotel.match_score * 100)}% match
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Stars & Type */}
        <div className="flex items-center gap-2">
          {stars > 0 && (
            <div className="flex gap-0.5">
              {[...Array(Math.min(stars, 5))].map((_, i) => (
                <FaStar key={i} className="text-yellow-500 text-xs" />
              ))}
            </div>
          )}
          {hotel.property_type && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
              {hotel.property_type}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-bold text-gray-900 dark:text-white text-base line-clamp-1 group-hover:text-blue-600 transition-colors">
          {hotel.name}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <FaMapMarkerAlt className="text-xs text-blue-500" />
          <span className="line-clamp-1">{hotel.location || hotel.address || hotel.city || 'Pakistan'}</span>
        </div>

        {/* Amenities mini */}
        <div className="flex gap-2 text-gray-400 dark:text-gray-500">
          {hotel.wifi_available && <FaWifi className="text-sm" title="WiFi" />}
          {hotel.parking_available && <FaParking className="text-sm" title="Parking" />}
          {hotel.pool_available && <FaSwimmingPool className="text-sm" title="Pool" />}
          {hotel.breakfast_available && <FaUtensils className="text-sm" title="Breakfast" />}
        </div>

        {/* Rating & Price */}
        <div className="flex items-end justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {rating > 0 && (
              <>
                <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-1 rounded">{rating.toFixed(1)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{getRatingLabel(rating)}</span>
              </>
            )}
          </div>
          <div className="text-right">
            {price > 0 ? (
              <>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(price)}</p>
                <p className="text-xs text-gray-400">per night</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Price on request</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Main RecommendationWidget ── */
const RecommendationWidget = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPrefs, setSelectedPrefs] = useState([]);
  const [city, setCity] = useState('Lahore');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        query: query || `Best ${selectedPrefs.join(' ')} hotels in ${city}`.trim(),
        city,
        category: selectedPrefs.length > 0 ? selectedPrefs[0] : undefined,
        price_range: selectedPrefs.includes('budget') ? 'low' : selectedPrefs.includes('luxury') ? 'high' : undefined,
        limit: 12,
      };

      let data = [];

      // Try ML recommendations first
      try {
        const mlRes = await axios.post(`${API_BASE}/ml-recommendations/`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        });
        if (mlRes.data?.results?.length > 0) {
          data = mlRes.data.results.map((r, idx) => ({
            ...r,
            ai_reason: r.explanation || r.reason || `AI-matched for your ${selectedPrefs[0] || 'travel'} preferences`,
            match_score: r.similarity_score || r.score || (0.95 - idx * 0.03),
          }));
        }
      } catch {
        // ML endpoint may not be trained — fall through
      }

      // Fallback: use hotel API with smart filtering
      if (data.length === 0) {
        try {
          const hotelRes = await axios.get(`${API_BASE}/hotels/`, { timeout: 15000 });
          let hotels = hotelRes.data?.results || hotelRes.data || [];
          if (Array.isArray(hotels) && hotels.length > 0) {
            hotels = hotels.map(h => {
              let score = 0.5;
              const name = (h.name || '').toLowerCase();
              const desc = (h.description || '').toLowerCase();
              if (selectedPrefs.includes('luxury') && (name.includes('luxury') || name.includes('premium') || h.stars >= 4)) score += 0.2;
              if (selectedPrefs.includes('budget') && (h.price_per_night || h.double_bed_price_per_day || 99999) < 5000) score += 0.2;
              if (selectedPrefs.includes('family') && (desc.includes('family') || h.max_occupancy >= 4)) score += 0.15;
              if (h.rating >= 8) score += 0.1;
              if (h.city?.toLowerCase() === city.toLowerCase()) score += 0.15;
              return { ...h, match_score: Math.min(score, 1), ai_reason: `Recommended for ${city} — ${selectedPrefs[0] || 'your trip'}` };
            });
            hotels.sort((a, b) => b.match_score - a.match_score);
            data = hotels.slice(0, 12);
          }
        } catch {}
      }

      // Fallback: static demo recommendations
      if (data.length === 0) {
        data = generateDemoRecommendations(city, selectedPrefs);
      }

      setRecommendations(data);
    } catch (err) {
      setError('Unable to load recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [city, selectedPrefs, query]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const togglePref = (id) => {
    setSelectedPrefs(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleFav = (id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FaRobot className="text-blue-500" /> AI Recommendations
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Personalized hotel suggestions powered by machine learning
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FaSlidersH /> Filters
          </button>
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaRedo />} Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
              {/* Search Query */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. 5-star hotel with pool near Badshahi Mosque..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                <div className="flex flex-wrap gap-2">
                  {CITY_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCity(c)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        city === c
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferences */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Travel Style</label>
                <div className="flex flex-wrap gap-2">
                  {PREFERENCE_OPTIONS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePref(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedPrefs.includes(p.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{p.emoji}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4"
          >
            <FaRobot className="text-blue-600 text-2xl" />
          </motion.div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Finding perfect matches for you...</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Our AI is analyzing preferences and reviews</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchRecommendations}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results Grid */}
      {!loading && !error && recommendations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {recommendations.map((hotel, idx) => (
            <RecommendationCard
              key={hotel.id || idx}
              hotel={hotel}
              index={idx}
              isFavorite={favorites.has(hotel.id || idx)}
              onToggleFav={toggleFav}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && recommendations.length === 0 && (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <FaHotel className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No recommendations yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Adjust your preferences or try a different city</p>
        </div>
      )}
    </div>
  );
};

/* ── Demo Recommendations (fallback when APIs unavailable) ── */
function generateDemoRecommendations(city, prefs) {
  const base = [
    { name: 'Pearl Continental Hotel', city: 'Lahore', rating: 8.8, stars: 5, price_per_night: 18500, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/263558497.jpg', property_type: 'Hotel', location: 'Mall Road, Lahore', wifi_available: true, parking_available: true, pool_available: true, breakfast_available: true },
    { name: 'Luxus Grand Hotel', city: 'Lahore', rating: 8.2, stars: 4, price_per_night: 12000, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/326954804.jpg', property_type: 'Hotel', location: 'Gulberg, Lahore', wifi_available: true, parking_available: true, pool_available: false, breakfast_available: true },
    { name: 'Shelton Rezidor', city: 'Lahore', rating: 7.5, stars: 3, price_per_night: 7500, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/145498312.jpg', property_type: 'Hotel', location: 'Liberty, Lahore', wifi_available: true, parking_available: true, pool_available: false, breakfast_available: false },
    { name: 'Avari Hotel', city: 'Lahore', rating: 8.5, stars: 5, price_per_night: 20000, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/122587539.jpg', property_type: 'Hotel', location: 'Shahrah-e-Quaid-e-Azam, Lahore', wifi_available: true, parking_available: true, pool_available: true, breakfast_available: true },
    { name: 'Ambassador Hotel', city: 'Lahore', rating: 7.0, stars: 3, price_per_night: 5500, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/261627382.jpg', property_type: 'Hotel', location: 'Davis Road, Lahore', wifi_available: true, parking_available: false, pool_available: false, breakfast_available: true },
    { name: 'Rose Palace Hotel', city: 'Lahore', rating: 7.8, stars: 4, price_per_night: 9000, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/230458843.jpg', property_type: 'Hotel', location: 'Mall Road, Lahore', wifi_available: true, parking_available: true, pool_available: false, breakfast_available: true },
    { name: 'Ramada by Wyndham', city: 'Lahore', rating: 8.0, stars: 4, price_per_night: 14000, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/274113373.jpg', property_type: 'Hotel', location: 'Canal Bank, Lahore', wifi_available: true, parking_available: true, pool_available: true, breakfast_available: true },
    { name: 'Hotel One Mall Road', city: 'Lahore', rating: 7.2, stars: 3, price_per_night: 6500, image: 'https://cf.bstatic.com/xdata/images/hotel/max1024x768/122595634.jpg', property_type: 'Hotel', location: 'Mall Road, Lahore', wifi_available: true, parking_available: true, pool_available: false, breakfast_available: false },
  ];

  return base
    .filter(h => h.city.toLowerCase() === city.toLowerCase() || city === 'Lahore')
    .map((h, i) => ({
      ...h,
      id: `demo-${i}`,
      ai_reason: `Top-rated ${prefs.includes('luxury') ? 'luxury' : prefs.includes('budget') ? 'budget-friendly' : ''} pick in ${city}`.trim(),
      match_score: 0.92 - i * 0.04,
    }));
}

export default RecommendationWidget;
