# Hotel API Integration Guide - Lahore, Pakistan

## 🎯 Overview
This document explains the integration of **Booking.com RapidAPI** for searching hotels in Lahore, Pakistan.

---

## 🔑 API Selection

**Selected API: Booking.com via RapidAPI**

### Why This API?
- ✅ **Free Tier Available**: 500 requests/month free
- ✅ **Comprehensive Data**: Hotel names, prices, ratings, images, amenities
- ✅ **City Filtering**: Filter by Lahore destination ID
- ✅ **Real-time Data**: Live hotel availability and pricing
- ✅ **PKR Currency**: Supports Pakistani Rupees
- ✅ **No Credit Card Required**: Free tier doesn't need payment info

### API Documentation
- **Provider**: RapidAPI
- **API**: Booking.com15
- **URL**: https://rapidapi.com/DataCrawler/api/booking-com15
- **Method**: GET
- **Endpoint**: `/api/v1/hotels/searchHotels`

---

## 🚀 Setup Instructions

### 1. Get Your API Key

1. Go to [RapidAPI Booking.com15](https://rapidapi.com/DataCrawler/api/booking-com15)
2. Sign up or log in
3. Click "Subscribe to Test"
4. Select the **FREE** plan (500 requests/month)
5. Copy your **X-RapidAPI-Key**

### 2. Configure Environment Variables

Create `.env` file in `/frontend` directory:

```bash
# RapidAPI Configuration
REACT_APP_RAPIDAPI_KEY=your_rapidapi_key_here
REACT_APP_RAPIDAPI_HOST=booking-com15.p.rapidapi.com
```

**⚠️ Security Note**: Never commit `.env` file to Git!

### 3. Install Dependencies

```bash
cd frontend
npm install axios
```

---

## 📁 Project Structure

```
frontend/src/
├── services/
│   └── hotelSearchAPI.js       # API service layer
├── components/
│   └── HotelSearchLahore.js    # Search UI component
└── App.js                       # Route configuration
```

---

## 🔧 Implementation Details

### API Service (`hotelSearchAPI.js`)

**Key Features:**
- Axios-based HTTP client
- Error handling with detailed messages
- Data parsing and formatting
- Default date handling
- Price extraction from multiple fields
- Image URL fallback
- Amenities extraction

**Main Function:**
```javascript
searchLahoreHotels({
  checkIn: '2025-12-10',
  checkOut: '2025-12-12',
  adults: 2,
  children: 0,
  roomType: 'double'
})
```

**Lahore Configuration:**
- Destination ID: `-2187133`
- Destination Type: `city`
- Currency: `PKR` (Pakistani Rupees)

---

### UI Component (`HotelSearchLahore.js`)

**Features:**
1. **Search Form**
   - Check-in/Check-out date pickers
   - Adults/Children/Infants selectors
   - Room type selection (Single, Double, Triple, Quad, Family)
   - Fixed destination: Lahore, Pakistan

2. **Results Display**
   - Hotel cards with images
   - Rating badges
   - Price in PKR
   - Address and location
   - Amenities icons (WiFi, Parking)
   - "View on Booking.com" links

3. **Loading States**
   - Spinner during API calls
   - Disabled search button while loading

4. **Error Handling**
   - Form validation
   - API error messages
   - No results messaging

---

## 🎨 Usage

### Access the Hotel Search

**URL:** `http://localhost:3000/hotels/search-lahore`

### Search Flow:
1. User selects check-in and check-out dates
2. User selects number of guests
3. User selects room type
4. Clicks "Search Hotels"
5. API fetches hotels from Booking.com
6. Results displayed in cards
7. User can view hotel details on Booking.com

---

## 📊 API Response Structure

### Sample Hotel Object
```javascript
{
  id: "12345",
  name: "Pearl Continental Hotel Lahore",
  address: "Shahrah-e-Quaid-e-Azam, Lahore 54000, Pakistan",
  city: "Lahore",
  country: "Pakistan",
  price: 25000,  // PKR
  rating: 8.5,
  reviewCount: 450,
  image: "https://cf.bstatic.com/...",
  amenities: {
    wifi: true,
    parking: true,
    pool: true,
    restaurant: true,
    gym: true
  },
  latitude: 31.5884,
  longitude: 74.3105,
  url: "https://www.booking.com/hotel/pk/..."
}
```

---

## 🛡️ Error Handling

### Types of Errors Handled:

1. **API Response Errors (4xx, 5xx)**
   - Displays API error message
   - Shows status code

2. **Network Errors**
   - "No response from API" message
   - Connection check prompt

3. **Validation Errors**
   - Date validation
   - Required field checks

4. **No Results**
   - "No hotels found" message
   - Suggests trying different dates

---

## 💰 API Pricing & Limits

### Free Tier
- **Requests**: 500/month
- **Rate Limit**: Standard
- **Cost**: $0.00
- **Credit Card**: Not required

### If You Need More:
- **Basic Plan**: $9.99/month - 10,000 requests
- **Pro Plan**: $49.99/month - 100,000 requests

---

## 🧪 Testing

### Test Search:
```javascript
// Example test parameters
{
  checkIn: "2025-12-10",
  checkOut: "2025-12-12",
  adults: 2,
  children: 0,
  roomType: "double"
}
```

### Expected Results:
- List of hotels in Lahore
- Prices in PKR
- Hotel images
- Ratings and reviews
- Working Booking.com links

---

## 🔍 Alternative Free APIs

If you need alternatives:

1. **Amadeus Hotel Search API**
   - Free tier: 1000 requests/month
   - URL: https://developers.amadeus.com

2. **Hotels.com RapidAPI**
   - Free tier: 500 requests/month
   - URL: https://rapidapi.com/apidojo/api/hotels-com-provider

3. **Priceline.com RapidAPI**
   - Free tier: 500 requests/month
   - URL: https://rapidapi.com/davidtaoweiji/api/priceline-com-provider

---

## 📝 Code Comments

All code includes:
- ✅ Function documentation
- ✅ Parameter descriptions
- ✅ Return type information
- ✅ Usage examples
- ✅ Error handling explanations

---

## 🚨 Important Notes

1. **API Key Security**
   - Never expose API keys in frontend code
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Rate Limiting**
   - Free tier: 500 requests/month
   - Cache results when possible
   - Show loading states

3. **Data Accuracy**
   - Prices are real-time
   - Availability is live
   - Book through Booking.com for confirmation

4. **Lahore Only**
   - Hardcoded to Lahore destination ID
   - Currency fixed to PKR
   - Only shows Lahore hotels

---

## 🎯 Next Steps

1. Get your RapidAPI key
2. Add to `.env` file
3. Install axios: `npm install axios`
4. Navigate to `/hotels/search-lahore`
5. Search for hotels in Lahore!

---

## 📞 Support

- **RapidAPI Support**: https://rapidapi.com/support
- **Booking.com API Docs**: Check RapidAPI dashboard
- **Issues**: Check console logs for detailed error messages

---

## ✅ Checklist

- [ ] Signed up for RapidAPI
- [ ] Got API key from Booking.com15 API
- [ ] Created `.env` file with API key
- [ ] Installed axios dependency
- [ ] Added route to App.js
- [ ] Tested search functionality
- [ ] Verified Lahore results only
- [ ] Checked error handling works

---

**🎉 You're all set! Happy hotel searching in Lahore!**
